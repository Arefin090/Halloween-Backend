const express = require('express');
const { google } = require('googleapis');
const bodyParser = require('body-parser');
const cors = require('cors');
require('dotenv').config(); // Load environment variables

// Create an Express app
const app = express();
app.use(bodyParser.json()); // Parse JSON request body

// CORS configuration
const corsOptions = {
  origin: '*', // Allow frontend origin (use environment variable or localhost)
  methods: 'GET,POST,OPTIONS', // Allow the necessary methods
  allowedHeaders: 'Content-Type,Authorization', // Allow necessary headers for your frontend
  credentials: true, // Allow cookies or other credentials if needed
  optionsSuccessStatus: 204, // Respond successfully for preflight requests
};

app.use(cors(corsOptions)); // Apply CORS middleware

// Handle preflight requests (OPTIONS method)
app.options('*', cors(corsOptions));

// Google Sheets setup
const auth = new google.auth.GoogleAuth({
  keyFile: 'credentials.json', // Path to your credentials.json file from Google Cloud
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

// Create a Google Sheets client
const sheets = google.sheets({ version: 'v4', auth });

const SPREADSHEET_ID = '1NYT1E8DcevYEC6Z3Soa1haYK3wW6LykQx8TtrgygKIc'; // Your spreadsheet ID

// Route to handle form submissions
app.post('/submit', async (req, res) => {
  const { name, email, address } = req.body;

  try {
    // Append data to the Google Sheet
    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Melbourne!A2:C2', // Assuming data goes into columns A, B, and C
      valueInputOption: 'RAW',
      resource: {
        values: [[name, email, address]], // Data being submitted
      },
    });

    res.status(200).send('Success! Your information has been saved.');
  } catch (error) {
    console.error('Error writing to Google Sheets:', error);
    res.status(500).send('Failed to write data to Google Sheets');
  }
});

// Start the server
const PORT = process.env.PORT || 5002; 

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
