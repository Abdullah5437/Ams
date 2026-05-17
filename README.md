# Frontend Documentation

This is the Next.js frontend for the Account Management System.

For the full project overview, see the root documentation:

`../README.md`

## Stack

- Next.js 15
- React 19
- Tailwind CSS
- Axios
- Reporting/export libraries:
  - `jspdf`
  - `jspdf-autotable`
  - `html2pdf.js`
  - `json-2-csv`
  - `xlsx`

## Main Frontend Structure

```text
src/app
|-- api_url.js
|-- RouteProtection.jsx
|-- ClientLayoutwrapper.jsx
|-- Pages/
|   |-- Login/
|   `-- Dashboard/
|-- Components/
|   |-- Navbar/
|   `-- Side&Topbar/
`-- context/
```

## Main Screens

Under `src/app/Pages/Dashboard` the app includes:

- Dashboard home
- Routes list
- Suppliers list
- Customers list
- Bank list
- Item list
- Purchase screens
- Sales screens
- Voucher screens
- Ledger screens
- Monthly and summary reports
- User management
- System settings

## Authentication Flow

- Login page: `src/app/Pages/Login/page.jsx`
- Route guard: `src/app/RouteProtection.jsx`
- Layout wrapper: `src/app/ClientLayoutwrapper.jsx`

The frontend stores the backend login response in `localStorage` under `user`, then validates the token through:

`POST /common/user/expiryCheck`

## API Configuration

The frontend talks to the backend using:

`src/app/api_url.js`

Current value:

```js
const end_points = "http://localhost:8080/common";
```

If your backend runs elsewhere, update this file before starting the app.

## Development

Install dependencies:

```bash
npm install
```

Run the development server:

```bash
npm run dev
```

Build for production:

```bash
npm run build
npm start
```

The default frontend URL is:

`http://localhost:3000`

## Reporting Features

The frontend includes printable/exportable report pages for:

- Sales
- Vouchers
- Customer wise reporting
- Receipt reporting
- Creditor summaries
- Debitor summaries
- Monthly reporting
- Bank ledger views

## Notes

- The app is heavily dashboard-driven and most pages are client components.
- Some helper files such as `extra.js` use hardcoded remote URLs for experiments or alternate report logic; the main application uses `api_url.js`.
- Login is skipped only for `/Pages/Login`; the rest of the layout is protected through the client-side guard.
