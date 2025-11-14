// MongoDB analysis script for ialex_legislation_ar database
const uri = "mongodb://root:BTJsBwDLPMNJ7EHHTmyl48TJ0zmg8AcuCkJiLpXS1VQgiPPmvJ9LdfO5101WeemV@31.97.20.213:5433/?directConnection=true";

async function analyzeDatabase() {
  try {
    const { MongoClient } = require('mongodb');
    const client = new MongoClient(uri);
    
    await client.connect();
    console.log("Connected to MongoDB");
    
    const db = client.db('ialex_legislation_ar');
    const collection = db.collection('ialex_legislation_ar');
    
    // Get total count
    const totalCount = await collection.countDocuments();
    console.log(`\nTotal documents: ${totalCount}`);
    
    // Get a sample document to understand structure
    const sample = await collection.findOne({});
    console.log("\nSample document structure:");
    console.log(JSON.stringify(sample, null, 2));
    
    // Analyze jurisdictions
    const jurisdictions = await collection.distinct('jurisdiction');
    console.log(`\nTotal unique jurisdictions: ${jurisdictions.length}`);
    console.log("Jurisdictions found:", jurisdictions);
    
    // Count documents per jurisdiction
    console.log("\n=== Documents per Jurisdiction ===");
    const jurisdictionCounts = await collection.aggregate([
      {
        $group: {
          _id: '$jurisdiction',
          count: { $sum: 1 }
        }
      },
      {
        $sort: { count: -1 }
      }
    ]).toArray();
    
    jurisdictionCounts.forEach(j => {
      console.log(`${j._id || 'null/undefined'}: ${j.count} documents`);
    });
    
    // Get additional statistics
    console.log("\n=== Additional Statistics ===");
    
    // Check for documents without jurisdiction
    const noJurisdiction = await collection.countDocuments({ jurisdiction: { $exists: false } });
    const nullJurisdiction = await collection.countDocuments({ jurisdiction: null });
    console.log(`Documents without jurisdiction field: ${noJurisdiction}`);
    console.log(`Documents with null jurisdiction: ${nullJurisdiction}`);
    
    // Get field statistics
    const fields = await collection.findOne({});
    if (fields) {
      console.log("\n=== Document Fields ===");
      console.log(Object.keys(fields).join(', '));
    }
    
    // Analyze by type if exists
    if (fields && fields.type) {
      const types = await collection.aggregate([
        {
          $group: {
            _id: '$type',
            count: { $sum: 1 }
          }
        },
        {
          $sort: { count: -1 }
        }
      ]).toArray();
      
      console.log("\n=== Documents by Type ===");
      types.forEach(t => {
        console.log(`${t._id || 'null/undefined'}: ${t.count} documents`);
      });
    }
    
    await client.close();
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  }
}

analyzeDatabase();

