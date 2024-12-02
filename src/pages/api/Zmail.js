import { supabase } from "../../../client"; // Import Supabase client
import { google } from "googleapis"; // Import Google APIs

// Set up Google Sheets API credentials and sheet details
const GOOGLE_CREDENTIALS = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_CREDENTIALS);
const SPREADSHEET_ID = process.env.SPREADSHEET_ID; // Add your Google Sheet ID here

export default async function handler(req, res) {
  console.log("Incoming response:", req.body);

  if (req.method === 'POST') {
    const {
      OrderReceived,
      email,
      company,
      ContactName,
      ContractNumber,
      StartDate,
      EndDate,
      products
    } = req.body;

    // Ensure 'products' is parsed as an array if it's a stringified JSON
    let parsedProducts = products;
    try {
      if (typeof products === 'string') {
        parsedProducts = JSON.parse(products); // Parse the stringified JSON
      }
    } catch (error) {
      console.error("Error parsing 'products':", error);
      return res.status(400).json({ error: "Invalid 'products' format" });
    }

    // Validate that 'products' is now an array
    if (!Array.isArray(parsedProducts)) {
      console.error("Invalid data: 'products' must be an array");
      return res.status(400).json({ error: "Invalid data: 'products' must be an array" });
    }

    // Log parsed products array for verification
    console.log("Parsed products array:", parsedProducts);

    const records = [];
    
    // Prepare an array of records to insert into Supabase
    parsedProducts.forEach((product) => {
      if (product.ProductDescription !== '') {
        // Insert multiple rows based on the quantity
        for (let i = 0; i < product.Quantity; i++) {
          const record = {
            OrderReceived,
            email,
            company,
            ContactName,
            ContractNumber,
            StartDate,
            EndDate,
            ProductDescription: product.ProductDescription,
            NewRenewal: product.NewRenewal,
            Term: product.Term,
            Quantity: 1 // Set Quantity as 1 for each row
          };
          records.push(record);
        }
      }
    });

    // Log the records to ensure they are formatted correctly
    console.log("Prepared records for insertion:", records);

    // Insert each product as a new row in the 'EmailTest' table
    const { data, error } = await supabase
      .from('EmailTest') // Replace with your actual table name
      .insert(records);

    // If there's an error, log and return a response with the error
    if (error) {
      console.error('Error inserting data:', error);
      return res.status(500).json({ error: 'Error saving data', details: error });
    }

    // Log the inserted data for confirmation
    console.log("Inserted data:", data);

    // Save to Google Sheets
    try {
      const auth = new google.auth.GoogleAuth({
        credentials: GOOGLE_CREDENTIALS,
        scopes: ["https://www.googleapis.com/auth/spreadsheets"],
      });

      const sheets = google.sheets({ version: "v4", auth });

      // Prepare rows for Google Sheets
      const sheetRows = records.map(record => [
        record.OrderReceived,
        record.email,
        record.company,
        record.ContactName,
        record.ContractNumber,
        record.StartDate,
        record.EndDate,
        record.ProductDescription,
        record.NewRenewal,
        record.Term,
        record.Quantity,
      ]);

      // Append rows to the sheet
      await sheets.spreadsheets.values.append({
        spreadsheetId: SPREADSHEET_ID,
        range: "Sheet1", // Change 'Sheet1' to your desired sheet name
        valueInputOption: "USER_ENTERED",
        resource: {
          values: sheetRows,
        },
      });

      console.log("Data added to Google Sheets successfully.");
    } catch (sheetError) {
      console.error("Error saving to Google Sheets:", sheetError);
      return res.status(500).json({ error: "Error saving to Google Sheets", details: sheetError });
    }

    res.status(200).json({ message: 'Data added successfully', data });
  } else {
    res.setHeader('Allow', ['POST']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}
