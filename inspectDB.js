import { MongoClient } from 'mongodb';
import dns from 'dns';

dns.setServers(['8.8.8.8', '8.8.4.4']);

const uri = "mongodb+srv://quantumbases:QB123.com.pk@hunarmand-punjab.7dbsn.mongodb.net/hunarmand-prd";

async function run() {
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db("hunarmand-prd");
    
    // List collections
    const collections = await db.listCollections().toArray();
    console.log("Collections:", collections.map(c => c.name));
    
    // Find candidate/student collection and inspect a document
    for (const c of collections) {
      if (c.name.toLowerCase().includes('candidate') || c.name.toLowerCase().includes('user') || c.name.toLowerCase().includes('student')) {
        console.log(`\nInspecting collection: ${c.name}`);
        const sample = await db.collection(c.name).findOne({});
        console.log("Sample document:", sample);
      }
    }
  } finally {
    await client.close();
  }
}

run().catch(console.dir);
