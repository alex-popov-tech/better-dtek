<div align="center">

# DTEK Power Outage Tracker

![License](https://img.shields.io/badge/license-MIT-blue)
![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?logo=typescript&logoColor=white)
![Svelte](https://img.shields.io/badge/Svelte-5-FF3E00?logo=svelte&logoColor=white)
![Tailwind](https://img.shields.io/badge/Tailwind-3.4-38B2AC?logo=tailwindcss&logoColor=white)

**Real-time power outage monitoring for Ukrainian DTEK regions**

Know when your lights go out — and when they come back on.

[Live Demo](https://dtek-theta.vercel.app/) | [Report Bug](https://github.com/alex-popov-tech/better-dtek/issues) | [Request Feature](https://github.com/alex-popov-tech/better-dtek/issues)

</div>

---

## Why Use This App?

Power outages in Ukraine are unpredictable. This app helps you:

- **Plan your day** — See scheduled outages hours in advance
- **Stay informed** — Get real-time status updates with visual traffic light indicators
- **Track multiple locations** — Monitor home, office, and family addresses in one place
- **Distinguish outage types** — Know if it's scheduled maintenance or an emergency

---

## Features

| Feature                                  | Description                                                                            |
| ---------------------------------------- | -------------------------------------------------------------------------------------- |
| :traffic_light: **Traffic Light Status** | Instant visual indicators — green (power on), yellow (possible outage), red (no power) |
| :house: **Multiple Addresses**           | Track unlimited locations with custom labels (Home, Work, Parents, etc.)               |
| :calendar: **Schedule View**             | See today's and tomorrow's planned outage windows                                      |
| :warning: **Emergency Alerts**           | Distinguish between scheduled and emergency outages with pulsing indicators            |
| :new_moon: **Dark/Light Theme**          | Easy on the eyes, day or night                                                         |
| :iphone: **Mobile-First Design**         | Responsive UI that works beautifully on any device                                     |

---

## Screenshots

<div align="center">

<img alt="Tablet Screenshot" src="https://github.com/user-attachments/assets/42fda2e1-f6f0-4ee7-8d22-5b8ae020a45e" />
<img alt="Mobile Screenshot" src="https://github.com/user-attachments/assets/fd8d461c-3707-457f-b958-384cc130f96f" />

</div>

---

## Quick Start

### Option 1: Use the Live App

Visit **[dtek-theta.vercel.app](https://dtek-theta.vercel.app/)** — no installation required!

### Option 2: Run Locally

```bash
# Clone the repository
git clone https://github.com/alex-popov-tech/better-dtek.git
cd better-dtek

# Install dependencies
npm install

# Start development server
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

---

## How It Works

1. **Add your address** — Select region, city, street, and building number
2. **See instant status** — Traffic light shows current power state
3. **Check the schedule** — View hourly breakdown for today and tomorrow
4. **Stay updated** — Emergency outages pulse red for immediate attention

The app fetches real-time data directly from DTEK's official systems and caches it locally for fast performance.

---

## Built With

<div align="center">

![SvelteKit](https://img.shields.io/badge/SvelteKit-FF3E00?style=for-the-badge&logo=svelte&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)
![Vercel](https://img.shields.io/badge/Vercel-000000?style=for-the-badge&logo=vercel&logoColor=white)

</div>

- **Framework:** SvelteKit with Svelte 5
- **Styling:** Tailwind CSS + Skeleton UI
- **Testing:** Vitest
- **Deployment:** Vercel (Frankfurt region for low latency to Ukraine)

---

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## License

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.

---

<div align="center">

Made with :heart: in Ukraine

[Report a Bug](https://github.com/alex-popov-tech/better-dtek/issues) · [Request a Feature](https://github.com/alex-popov-tech/better-dtek/issues)

</div>
