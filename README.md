# PelosiApp

PelosiApp is a full-stack application designed to track and display stock trades made by members of the U.S. Congress. It consists of a React Native mobile application, a FastAPI backend to serve the data, and a separate database service that scrapes and stores the trade information.

## Architecture

The project is a monorepo containing three distinct services:

1.  **`PelosiUI` (Frontend):** A mobile application built with React Native and Expo. It provides the user interface for viewing congressional trade data, stock details, and managing a personal asset watchlist.
2.  **`PelosiBE` (Backend):** A FastAPI server that acts as the primary API for the mobile frontend. It queries the database and fetches external stock data from sources like yfinance and Finnhub.
3.  **`PelosiDB` (Database Service):** A dedicated FastAPI service responsible for database management. It includes a scheduled task (`apscheduler`) to scrape congressional trading data and populate the PostgreSQL database.

## Features

-   **View Congressional Trades:** Browse a list of recent stock transactions grouped by ticker symbol.
-   **Filter and Search:** Filter trades by congressperson, date range (last 7, 30, 90 days), and search for specific tickers.
-   **Detailed Stock View:**
    -   Interactive price charts (powered by `react-native-gifted-charts`).
    -   Key analytics such as high, low, and average price over the selected period.
    -   Analyst recommendation trends (Buy, Hold, Sell).
    -   Related company news from the Finnhub API.
-   **Personal Watchlist ("My Assets"):** Add stocks to a personal list to track their performance since the date of a congressional trade.
-   **Transaction History:** View all congressional transactions associated with a specific stock.

## Technology Stack

| Component            | Technologies Used                                                                                             |
| -------------------- | ------------------------------------------------------------------------------------------------------------- |
| **Frontend**         | React Native, Expo, Zustand (State Management), React Navigation, `react-native-gifted-charts`                  |
| **Backend API**      | Python 3.10, FastAPI, Uvicorn, yfinance, Finnhub API, Psycopg2                                                    |
| **Database Service** | Python 3.10, FastAPI, APScheduler (for scheduled scraping), Psycopg2                                            |
| **Database**         | PostgreSQL                                                                                                    |
| **Containerization** | Docker                                                                                                        |

## Project Structure

```
.
├── PelosiBE/     # FastAPI backend for the UI
├── PelosiDB/     # FastAPI service for scraping & DB management
└── PelosiUI/     # React Native (Expo) mobile application
```

## Setup and Installation

### Prerequisites

-   Python 3.10+
-   Node.js and a package manager (npm or yarn)
-   Docker and Docker Compose
-   A running PostgreSQL instance

### 1. Environment Variables

Both backend services require a `.env` file for configuration. Create a `.env` file in both the `PelosiBE` and `PelosiDB` directories with the following content:

```bash
# Database Configuration
DB_HOST=your_db_host
DB_NAME=your_db_name
DB_USER=your_db_user
DB_PASSWORD=your_db_password
DB_PORT=5432
DB_SSLMODE=require

# API Security
API_PASSWORD=your_secret_api_password

# External APIs
FINNHUB_API_KEY=your_finnhub_api_key
```

### 2. Database Service (`PelosiDB`)

This service initializes the database schema and runs a scheduled scraper.

```bash
# Navigate to the database service directory
cd PelosiDB

# Create and activate a virtual environment
python3 -m venv venv
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Run the service
# The database tables will be created on startup, and the scraper will run.
uvicorn main:app --host 0.0.0.0 --port 8000
```

### 3. Backend API (`PelosiBE`)

This service provides the data needed for the mobile application.

```bash
# Navigate to the backend directory
cd PelosiBE

# Create and activate a virtual environment
python3 -m venv venv
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Run the API server
uvicorn main:app --host 0.0.0.0 --port 3000
```

### 4. Frontend (`PelosiUI`)

This is the Expo-based mobile application.

1.  **Configure API Connection:**
    Create a file at `PelosiUI/config/Config.js` (note: this file is git-ignored). Add the following content, replacing the URL and password with your local backend's details.

    ```javascript
    // PelosiUI/config/Config.js
    export const API_CONFIG = {
      BASE_URL: 'http://<YOUR_LOCAL_IP_ADDRESS>:3000', // e.g., http://192.168.1.10:3000
      API_PASSWORD: 'your_secret_api_password'
    };
    ```

2.  **Install & Run:**

    ```bash
    # Navigate to the UI directory
    cd PelosiUI

    # Install dependencies
    npm install

    # Start the Expo development server
    npm start
    ```

    You can then run the app on a physical device using the Expo Go app or on a simulator/emulator.

## Docker

The `PelosiBE` directory contains a `Dockerfile.slim` optimized for production. You can build and run the backend API in a container.

```bash
# Navigate to the backend directory
cd PelosiBE

# Build the Docker image
docker build -t pelosi-be -f Dockerfile.slim .

# Run the container, passing in the environment variables
docker run -d -p 3000:3000 \
  --name pelosi-be-container \
  -e DB_HOST="your_db_host" \
  -e DB_NAME="your_db_name" \
  -e DB_USER="your_db_user" \
  -e DB_PASSWORD="your_db_password" \
  -e DB_PORT="5432" \
  -e DB_SSLMODE="require" \
  -e API_PASSWORD="your_secret_api_password" \
  -e FINNHUB_API_KEY="your_finnhub_api_key" \
  pelosi-be
```

## API Endpoints

The `PelosiBE` service exposes the following endpoints. All endpoints require the `password` query parameter for authentication.

| Method | Endpoint                                             | Description                                                              |
| :----- | :--------------------------------------------------- | :----------------------------------------------------------------------- |
| `GET`  | `/`                                                  | Root endpoint to check if the API is running.                            |
| `GET`  | `/stocks/{ticker}`                                   | Get historical price data for a specific stock ticker.                   |
| `GET`  | `/stocks/recommendation-trends/{ticker}`             | Get analyst recommendation trends from Finnhub.                          |
| `GET`  | `/stocks/company-news/{ticker}`                      | Get company news for a specific ticker from Finnhub.                     |
| `GET`  | `/congresstrades/congresspeople`                     | Get a list of all congresspeople who have made trades.                   |
| `GET`  | `/congresstrades/tickers`                            | Get a list of all unique stock tickers that have been traded.            |
| `GET`  | `/congresstrades/load_existing_data`                 | Loads all transaction data, grouped for display on the home screen.      |
| `POST` | `/congresstrades/find_same_politician_same_stock_type` | (Internal utility) Finds trades by the same politician for the same stock. |
