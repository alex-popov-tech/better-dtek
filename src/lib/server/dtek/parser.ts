/**
 * DTEK HTML parser module
 * Extracts CSRF token and DisconSchedule data from DTEK template page
 * Refactored from parse_data.js
 */

import * as cheerio from 'cheerio';
import { parse as acornParse } from 'acorn';
import type {
	DtekTemplateData,
	Result,
	ParseError,
	RegionUnavailableError,
	DtekRawPreset,
	ScheduleStatus,
	ScheduleRange,
	ProcessedSchedules,
} from '$lib/types';
import { ok, err, parseError, regionUnavailableError } from '$lib/types';
import { dtekTemplateDataSchema } from '$lib/schemas';
import type { Node, Property, ObjectExpression } from 'acorn';

// AST node type extensions for acorn
interface Identifier extends Node {
	type: 'Identifier';
	name: string;
}

interface Literal extends Node {
	type: 'Literal';
	value: string | number | boolean | null;
}

interface ArrayExpression extends Node {
	type: 'ArrayExpression';
	elements: Node[];
}

interface UnaryExpression extends Node {
	type: 'UnaryExpression';
	operator: string;
	argument: Node;
}

interface Program extends Node {
	type: 'Program';
	body: Node[];
}

interface ExpressionStatement extends Node {
	type: 'ExpressionStatement';
	expression: Node;
}

interface AssignmentExpression extends Node {
	type: 'AssignmentExpression';
	left: Node;
	right: Node;
}

// Type guard for MemberExpression
interface MemberExpression extends Node {
	type: 'MemberExpression';
	object: Node;
	property: Node;
	computed: boolean;
}

/**
 * Check if HTML contains Incapsula bot protection markers
 * @param html - HTML string to check
 * @returns true if bot protection is detected
 */
function isBotProtectionPage(html: string): boolean {
	// Incapsula bot protection indicators
	return html.includes('_Incapsula_Resource') || html.includes('SWJIYLWA');
}

/**
 * Extract CSRF token from <meta name="csrf-token" content="...">
 * @param html - HTML string from DTEK template page
 * @returns Result with CSRF token or ParseError/RegionUnavailableError
 */
export function extractCsrfMeta(html: string): Result<string, ParseError | RegionUnavailableError> {
	try {
		const $ = cheerio.load(html);
		const csrf = $('meta[name="csrf-token"]').attr('content');

		if (!csrf) {
			// Check if this is a bot protection page (Incapsula)
			if (isBotProtectionPage(html)) {
				return err(
					regionUnavailableError(
						'Region blocked by bot protection',
						undefined // Region is not known at parser level
					)
				);
			}

			return err(
				parseError('csrf', 'CSRF token meta tag not found in HTML', {
					expected: '<meta name="csrf-token" content="...">',
					found: html.length > 500 ? `${html.slice(0, 500)}...` : html,
				})
			);
		}

		return ok(csrf);
	} catch (cause) {
		return err(
			parseError('csrf', 'Failed to parse HTML while extracting CSRF token', {
				expected: 'Valid HTML document',
				cause,
			})
		);
	}
}

/**
 * Check if AST node is a member expression matching objName.propName
 * @param node - AST node to check
 * @param objName - Expected object name (e.g., "DisconSchedule")
 * @param propName - Expected property name (e.g., "streets")
 */
function isMember(node: Node | null | undefined, objName: string, propName: string): boolean {
	if (!node || node.type !== 'MemberExpression') return false;

	const memberNode = node as MemberExpression;
	const objOk =
		memberNode.object?.type === 'Identifier' && (memberNode.object as Identifier).name === objName;

	if (!objOk) return false;

	if (!memberNode.computed && memberNode.property?.type === 'Identifier') {
		return (memberNode.property as Identifier).name === propName;
	}
	if (memberNode.computed && memberNode.property?.type === 'Literal') {
		return String((memberNode.property as Literal).value) === propName;
	}
	return false;
}

/**
 * Convert AST Property node's key to string
 * @param prop - AST Property node
 * @returns Property key as string or null
 */
function propKeyToString(prop: Node | null | undefined): string | null {
	if (!prop || prop.type !== 'Property') return null;
	const p = prop as Property;
	if (!p.computed && p.key?.type === 'Identifier') return (p.key as Identifier).name;
	if (p.key?.type === 'Literal') return String((p.key as Literal).value);
	return null;
}

/**
 * Maximum recursion depth for AST evaluation to prevent stack overflow
 */
const MAX_AST_DEPTH = 50;

/**
 * Result type for AST evaluation - represents all possible JS literal values
 */
type AstValue = string | number | boolean | null | AstValue[] | { [key: string]: AstValue };

/**
 * Evaluate AST node containing only literal values (safe evaluation)
 * Supports: Literal, ArrayExpression, ObjectExpression, UnaryExpression
 * @param node - AST node to evaluate
 * @param depth - Current recursion depth (default 0)
 * @returns Evaluated value
 * @throws Error if node type is unsupported or max depth exceeded
 */
function evalAst(node: Node | null | undefined, depth: number = 0): AstValue {
	if (depth > MAX_AST_DEPTH) {
		throw new Error(`AST evaluation exceeded maximum depth of ${MAX_AST_DEPTH}`);
	}

	// only safe literal-ish nodes
	switch (node?.type) {
		case 'Literal':
			return (node as Literal).value;
		case 'ArrayExpression':
			return (node as ArrayExpression).elements.map((el: Node) => evalAst(el, depth + 1));
		case 'ObjectExpression': {
			const out: Record<string, AstValue> = Object.create(null);
			for (const p of (node as ObjectExpression).properties) {
				if (p.type !== 'Property') continue;
				const k = propKeyToString(p);
				if (k == null) continue;
				out[k] = evalAst((p as Property).value as Node, depth + 1);
			}
			return out;
		}
		case 'UnaryExpression': {
			const unary = node as UnaryExpression;
			if (unary.operator === '-' && unary.argument?.type === 'Literal') {
				return -Number((unary.argument as Literal).value);
			}
			throw new Error(`Unsupported UnaryExpression: ${unary.operator}`);
		}
		default:
			throw new Error(`Unsupported AST node type: ${node?.type}`);
	}
}

/**
 * Find DisconSchedule.streets, DisconSchedule.fact, and DisconSchedule.preset assignments in script
 * @param code - JavaScript code from inline script tag
 * @returns Object with streetsObj, factObj, and presetObj AST nodes (or null if not found)
 */
function findAssignmentsInScript(code: string): {
	streetsObj: ObjectExpression | null;
	factObj: ObjectExpression | null;
	presetObj: ObjectExpression | null;
} {
	let ast;
	try {
		ast = acornParse(code, { ecmaVersion: 'latest', sourceType: 'script' });
	} catch {
		return { streetsObj: null, factObj: null, presetObj: null };
	}

	let streetsObj: ObjectExpression | null = null;
	let factObj: ObjectExpression | null = null;
	let presetObj: ObjectExpression | null = null;

	for (const stmt of (ast as Program).body) {
		if (stmt.type !== 'ExpressionStatement') continue;
		const exprStmt = stmt as ExpressionStatement;
		const expr = exprStmt.expression;
		if (!expr || expr.type !== 'AssignmentExpression') continue;

		const assignment = expr as AssignmentExpression;
		if (
			!streetsObj &&
			isMember(assignment.left, 'DisconSchedule', 'streets') &&
			assignment.right?.type === 'ObjectExpression'
		) {
			streetsObj = assignment.right as ObjectExpression;
		}

		if (
			!factObj &&
			isMember(assignment.left, 'DisconSchedule', 'fact') &&
			assignment.right?.type === 'ObjectExpression'
		) {
			factObj = assignment.right as ObjectExpression;
		}

		if (
			!presetObj &&
			isMember(assignment.left, 'DisconSchedule', 'preset') &&
			assignment.right?.type === 'ObjectExpression'
		) {
			presetObj = assignment.right as ObjectExpression;
		}

		if (streetsObj && factObj && presetObj) break;
	}

	return { streetsObj, factObj, presetObj };
}

/**
 * Extract update timestamp from DisconSchedule.fact object
 * @param factObjExpr - AST ObjectExpression for fact object
 * @returns Update timestamp string or null
 */
function extractUpdateFromFactObject(factObjExpr: ObjectExpression | null): string | null {
	if (!factObjExpr || factObjExpr.type !== 'ObjectExpression') return null;
	for (const p of factObjExpr.properties) {
		if (p.type !== 'Property') continue;
		const k = propKeyToString(p);
		if (k === 'update') {
			const value = evalAst((p as Property).value as Node);
			return typeof value === 'string' ? value : null;
		}
	}
	return null;
}

/**
 * Normalize schedule status to base type for merging
 * mfirst/msecond → maybe, first/second → no
 */
type NormalizedStatus = 'yes' | 'maybe' | 'no';

function normalizeStatus(status: ScheduleStatus): NormalizedStatus {
	if (status === 'yes') return 'yes';
	if (status === 'maybe' || status === 'mfirst' || status === 'msecond') return 'maybe';
	return 'no'; // 'no', 'first', 'second'
}

/**
 * Add a range, merging with previous if same status and adjacent
 */
function addRange(
	ranges: ScheduleRange[],
	from: number,
	to: number,
	status: NormalizedStatus
): void {
	const last = ranges[ranges.length - 1];
	if (last && last.to === from && last.status === status) {
		last.to = to;
	} else {
		ranges.push({ from, to, status });
	}
}

/**
 * Compress hourly schedule to ranges with normalized statuses
 * Input: { "1": "maybe", "2": "yes", ... "24": "maybe" }
 * Output: [{ from: 0, to: 1, status: "maybe" }, { from: 1, to: 2, status: "yes" }, ...]
 *
 * Hour key mapping: "1" → 00:00-01:00, "10" → 09:00-10:00
 *
 * Half-hour statuses mean:
 * - mfirst: first 30 min = maybe, second 30 min = yes
 * - msecond: first 30 min = yes, second 30 min = maybe
 * - first: first 30 min = no, second 30 min = yes
 * - second: first 30 min = yes, second 30 min = no
 */
function compressDaySchedule(dayData: Record<string, ScheduleStatus>): ScheduleRange[] {
	const ranges: ScheduleRange[] = [];

	for (let hourKey = 1; hourKey <= 24; hourKey++) {
		const rawStatus = dayData[String(hourKey)];
		if (!rawStatus) continue;

		const hourStart = hourKey - 1; // "1" means 00:00

		if (rawStatus === 'mfirst') {
			// First 30 min: maybe, Second 30 min: yes
			addRange(ranges, hourStart, hourStart + 0.5, 'maybe');
			addRange(ranges, hourStart + 0.5, hourStart + 1, 'yes');
		} else if (rawStatus === 'msecond') {
			// First 30 min: yes, Second 30 min: maybe
			addRange(ranges, hourStart, hourStart + 0.5, 'yes');
			addRange(ranges, hourStart + 0.5, hourStart + 1, 'maybe');
		} else if (rawStatus === 'first') {
			// First 30 min: no, Second 30 min: yes
			addRange(ranges, hourStart, hourStart + 0.5, 'no');
			addRange(ranges, hourStart + 0.5, hourStart + 1, 'yes');
		} else if (rawStatus === 'second') {
			// First 30 min: yes, Second 30 min: no
			addRange(ranges, hourStart, hourStart + 0.5, 'yes');
			addRange(ranges, hourStart + 0.5, hourStart + 1, 'no');
		} else {
			// Full hour: yes, maybe, or no
			addRange(ranges, hourStart, hourStart + 1, normalizeStatus(rawStatus));
		}
	}

	return ranges;
}

/**
 * Process raw preset schedules into compressed format
 * @param rawPreset - Raw preset data from DisconSchedule.preset
 * @returns Processed schedules grouped by groupId and day
 */
export function processPresetSchedules(rawPreset: DtekRawPreset): ProcessedSchedules {
	const result: ProcessedSchedules = {};

	for (const [groupId, weekData] of Object.entries(rawPreset.data)) {
		result[groupId] = {};
		for (const [dayNum, dayData] of Object.entries(weekData)) {
			result[groupId][dayNum] = compressDaySchedule(dayData);
		}
	}

	return result;
}

/**
 * Extract DisconSchedule.preset (non-fatal)
 * @param html - HTML string from DTEK template page
 * @returns Raw preset data or null if not found
 */
export function extractPresetData(html: string): DtekRawPreset | null {
	try {
		const $ = cheerio.load(html);
		const scripts = $('script')
			.map((_, el) => $(el).html() || '')
			.get();

		for (const code of scripts) {
			if (!code.includes('DisconSchedule.preset')) continue;
			const { presetObj } = findAssignmentsInScript(code);
			if (presetObj) {
				const raw = evalAst(presetObj) as unknown as DtekRawPreset;
				if (raw.data && typeof raw.data === 'object') {
					return raw;
				}
			}
		}

		console.warn('[Parser] DisconSchedule.preset not found');
		return null;
	} catch (e) {
		console.error('[Parser] Failed to extract preset:', e);
		return null;
	}
}

/**
 * Extract DisconSchedule.streets and DisconSchedule.fact from HTML
 * @param html - HTML string from DTEK template page
 * @returns Result with streetsByCity map and updateFact timestamp, or ParseError
 */
export function extractDisconScheduleData(
	html: string
): Result<{ streetsByCity: Record<string, string[]>; updateFact: string }, ParseError> {
	try {
		const $ = cheerio.load(html);

		// find the script that contains the assignments
		const scripts = $('script')
			.map((_, el) => $(el).html() || '')
			.get();

		let streetsObj: ObjectExpression | null = null;
		let factObj: ObjectExpression | null = null;

		for (const code of scripts) {
			if (!code.includes('DisconSchedule')) continue;
			if (!code.includes('DisconSchedule.streets') && !code.includes('DisconSchedule.fact'))
				continue;

			const found = findAssignmentsInScript(code);
			streetsObj ||= found.streetsObj;
			factObj ||= found.factObj;

			if (streetsObj && factObj) break;
		}

		if (!streetsObj) {
			return err(
				parseError('discon_streets', 'DisconSchedule.streets assignment not found in HTML', {
					expected: 'DisconSchedule.streets = {...}',
					found: 'No matching script block found',
				})
			);
		}

		if (!factObj) {
			return err(
				parseError('discon_fact', 'DisconSchedule.fact assignment not found in HTML', {
					expected: 'DisconSchedule.fact = {...}',
					found: 'No matching script block found',
				})
			);
		}

		const updateFact = extractUpdateFromFactObject(factObj);
		if (!updateFact) {
			return err(
				parseError('discon_fact', 'update property not found in DisconSchedule.fact', {
					expected: 'DisconSchedule.fact = { update: "..." }',
				})
			);
		}

		const streetsByCity = evalAst(streetsObj) as unknown as Record<string, string[]>;

		return ok({
			streetsByCity,
			updateFact,
		});
	} catch (cause) {
		return err(
			parseError('template', 'Failed to extract DisconSchedule data from HTML', {
				expected: 'Script containing DisconSchedule assignments',
				cause,
			})
		);
	}
}

/**
 * Parse DTEK template HTML and extract all required data
 * @param html - HTML string from DTEK template page
 * @returns Result with DtekTemplateData or ParseError/RegionUnavailableError
 */
export function parseTemplate(
	html: string
): Result<DtekTemplateData, ParseError | RegionUnavailableError> {
	const csrfResult = extractCsrfMeta(html);
	if (!csrfResult.ok) {
		return csrfResult;
	}

	const scheduleResult = extractDisconScheduleData(html);
	if (!scheduleResult.ok) {
		return scheduleResult;
	}

	const cities = Object.keys(scheduleResult.value.streetsByCity).sort();

	// Extract preset data (non-fatal)
	const rawPreset = extractPresetData(html);

	// Build template data object
	const templateData = {
		csrf: csrfResult.value,
		updateFact: scheduleResult.value.updateFact,
		cities,
		streetsByCity: scheduleResult.value.streetsByCity,
		schedules: rawPreset ? processPresetSchedules(rawPreset) : undefined,
	};

	// Validate the complete template data structure
	const validationResult = dtekTemplateDataSchema.safeParse(templateData);
	if (!validationResult.success) {
		const errorDetails = validationResult.error.flatten();
		console.error('[Parser] Template data validation failed:', errorDetails);
		return err(
			parseError('template', 'Parsed template data failed validation', {
				expected: 'Valid DtekTemplateData structure',
				found: JSON.stringify(errorDetails.fieldErrors),
			})
		);
	}

	return ok(validationResult.data as DtekTemplateData);
}
