// Code to run the server and handle requests
const express = require('express');
const { google } = require('googleapis');
const bodyParser = require('body-parser');
const cors = require('cors');
const { Pool } = require('pg');
const cluster = require('cluster'); // Clustering module
const os = require('os'); // OS module to get the number of CPU cores
require('dotenv').config(); // Load environment variables
const fetch = require('node-fetch'); // Node.js module to make HTTP requests

// PostgreSQL connection setup
const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'halloween_events',
  password: process.env.PG_PASSWORD,
  port: 5432,
});

//clustering setup
if (cluster.isMaster) {
  const numCPUs = os.cpus().length;
  console.log(`Master process is running. Forking ${numCPUs} workers...`);

  for (let i = 0; i < numCPUs; i++) {
    cluster.fork();
  }

  cluster.on('exit', (worker, code, signal) => {
    console.log(`Worker ${worker.process.pid} died. Forking a new worker...`);
    cluster.fork();
  });
} else {

  const app = express();
  app.use(bodyParser.json());

  // CORS configuration
  const corsOptions = {
    origin: '*',
    methods: 'GET,POST,OPTIONS',
    allowedHeaders: 'Content-Type,Authorization',
    credentials: true,
    optionsSuccessStatus: 204,
  };
  app.use(cors(corsOptions));
  app.options('*', cors(corsOptions));

  const auth = new google.auth.GoogleAuth({
    keyFile: 'credentials.json',
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });

  const sheets = google.sheets({ version: 'v4', auth });

  app.post('/submit', async (req, res) => {
    const { name, email, address, newsletter } = req.body;

    try {
      // Check if the address has already been geocoded
      const checkAddress = await pool.query('SELECT latitude, longitude FROM form_submissions WHERE address = $1', [address]);

      let latitude, longitude;

      if (checkAddress.rows.length > 0) {
        // Use cached coordinates
        latitude = checkAddress.rows[0].latitude;
        longitude = checkAddress.rows[0].longitude;
      } else {
        // Use Google Geocoding API to get the latitude and longitude
        const geocodingUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${process.env.GOOGLE_API_KEY}`;

        const response = await fetch(geocodingUrl);
        const result = await response.json();

        if (result.status === 'OK') {
          latitude = result.results[0].geometry.location.lat;
          longitude = result.results[0].geometry.location.lng;

          // Save the new geocoded address to the database
          await pool.query(
            'INSERT INTO form_submissions (name, email, address, newsletter, latitude, longitude) VALUES ($1, $2, $3, $4, $5, $6)',
            [name, email, address, newsletter, latitude, longitude]
          );
        } else {
          throw new Error('Geocoding failed: ' + result.status);
        }
      }

      // Append data to Google Sheets (optional, as before)
      await sheets.spreadsheets.values.append({
        spreadsheetId: process.env.SPREADSHEET_ID,
        range: 'Melbourne!A2:D2',
        valueInputOption: 'RAW',
        resource: {
          values: [[name, email, address, newsletter]],
        },
      });

      res.status(200).send({
        message: 'Success! Your information has been saved.',
      });
    } catch (error) {
      console.error('Error saving data:', error);
      res.status(500).send('Failed to save data.');
    }
  });

  app.get('/addresses', async (req, res) => {
    try {
      const result = await pool.query('SELECT address, latitude, longitude FROM form_submissions');
      res.status(200).json(result.rows);
    } catch (error) {
      console.error('Error retrieving addresses:', error);
      res.status(500).send('Failed to retrieve addresses.');
    }
  });

  const PORT = process.env.PORT || 5002;

  app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
}
