import { supabase } from "../../client";

async function saveProductDetailsToDatabase(products) {
    const { data, error } = await supabase
      .from('EmailTest') // Replace with your actual table name
      .insert(products);
  
    if (error) {
      console.error('Error inserting data:', error);
      throw error;
    }
  
    console.log('Data inserted:', data);
  }
  