import { supabase } from "../../../client";
// pages/api/webhook.js


export default async function handler(req, res) {
  if (req.method === 'POST') {
    const parsedData = req.body; // Capture parsed data sent by Zoho Email Parser
    console.log("resp",res);
    

    try {
      // Insert parsed data into your Supabase table
      const { data, error } = await supabase
        .from('EmailTest') // Replace with your table name
        .insert([parsedData]);

      if (error) {
        throw error;
      }

      // Respond to Zoho Email Parser with success status
      res.status(200).json({ message: 'Data stored successfully', data });
    } catch (error) {
      console.error('Error saving to Supabase:', error);
      res.status(500).json({ message: 'Error storing data', error });
    }
  } else {

    res.status(405).json({ message: 'Method Not Allowed' });
  }
}
