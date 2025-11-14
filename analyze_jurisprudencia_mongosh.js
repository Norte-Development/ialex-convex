// MongoDB analysis script for ialex_jurisprudencia_ar collection using mongosh
use('ialex_legislation_ar');

const collection = db.getCollection('ialex_jurisprudencia_ar');

// Get total count
const totalCount = collection.countDocuments();
print(`\nTotal documents: ${totalCount}`);

// Get a sample document to understand structure
const sample = collection.findOne({});
print("\n=== Sample Document Structure ===");
printjson(sample);

// Analyze jurisdictions (using 'jurisdiccion' field)
const jurisdictions = collection.distinct('jurisdiccion');
print(`\n=== Jurisdictions Analysis ===`);
print(`Total unique jurisdictions: ${jurisdictions.length}`);
print("Jurisdictions found:");
printjson(jurisdictions);

// Count documents per jurisdiction
print("\n=== Documents per Jurisdiction ===");
const jurisdictionCounts = collection.aggregate([
  {
    $group: {
      _id: '$jurisdiccion',
      count: { $sum: 1 }
    }
  },
  {
    $sort: { count: -1 }
  }
]).toArray();

jurisdictionCounts.forEach(j => {
  print(`${j._id || 'null/undefined'}: ${j.count} documents`);
});

// Check for documents without jurisdiction
const noJurisdiction = collection.countDocuments({ jurisdiccion: { $exists: false } });
const nullJurisdiction = collection.countDocuments({ jurisdiccion: null });
print(`\nDocuments without jurisdiccion field: ${noJurisdiction}`);
print(`Documents with null jurisdiccion: ${nullJurisdiction}`);

// Get field statistics
if (sample) {
  print("\n=== Document Fields ===");
  print(Object.keys(sample).join(', '));
}

// Analyze by tipo if exists
if (sample && sample.tipo !== undefined) {
  print("\n=== Documents by Tipo ===");
  const tipos = collection.aggregate([
    {
      $group: {
        _id: '$tipo',
        count: { $sum: 1 }
      }
    },
    {
      $sort: { count: -1 }
    }
  ]).toArray();
  
  tipos.forEach(t => {
    print(`${t._id || 'null/undefined'}: ${t.count} documents`);
  });
}

// Additional analysis: check for other relevant fields
print("\n=== Additional Field Analysis ===");

// Analyze by tipo_detalle if exists
if (sample && sample.tipo_detalle !== undefined) {
  print("\n=== Documents by Tipo Detalle ===");
  const tiposDetalle = collection.aggregate([
    {
      $group: {
        _id: '$tipo_detalle',
        count: { $sum: 1 }
      }
    },
    {
      $sort: { count: -1 }
    }
  ]).toArray();
  
  tiposDetalle.forEach(t => {
    print(`  ${t._id || 'null/undefined'}: ${t.count} documents`);
  });
}

// Analyze by instancia if exists
if (sample && sample.instancia !== undefined) {
  print("\n=== Documents by Instancia ===");
  const instancias = collection.aggregate([
    {
      $group: {
        _id: '$instancia',
        count: { $sum: 1 }
      }
    },
    {
      $sort: { count: -1 }
    }
  ]).toArray();
  
  instancias.forEach(i => {
    print(`  ${i._id || 'null/undefined'}: ${i.count} documents`);
  });
}

// Analyze by fuente
print("\n=== Documents by Fuente (Source) ===");
const fuentes = collection.aggregate([
  {
    $group: {
      _id: '$fuente',
      count: { $sum: 1 }
    }
  },
  {
    $sort: { count: -1 }
  }
]).toArray();

fuentes.forEach(f => {
  print(`  ${f._id || 'null/undefined'}: ${f.count} documents`);
});

// Detailed breakdown: Jurisdiction + Tipo Detalle (if exists)
if (sample && sample.tipo_detalle !== undefined) {
  print("\n=== Detailed Breakdown: Jurisdiction x Tipo Detalle ===");
  const jurisdictionTipo = collection.aggregate([
    {
      $group: {
        _id: {
          jurisdiccion: '$jurisdiccion',
          tipo_detalle: '$tipo_detalle'
        },
        count: { $sum: 1 }
      }
    },
    {
      $sort: { '_id.jurisdiccion': 1, count: -1 }
    }
  ]).toArray();
  
  let currentJurisdiction = null;
  jurisdictionTipo.forEach(jt => {
    const jurisdiccion = jt._id.jurisdiccion || 'null/undefined';
    const tipo = jt._id.tipo_detalle || 'null/undefined';
    
    if (currentJurisdiction !== jurisdiccion) {
      currentJurisdiction = jurisdiccion;
      print(`\n${jurisdiccion}:`);
    }
    print(`  ${tipo}: ${jt.count} documents`);
  });
}

// Date range analysis
print("\n=== Date Range Analysis ===");
const dateStats = collection.aggregate([
  {
    $group: {
      _id: null,
      minDate: { $min: '$date' },
      maxDate: { $max: '$date' },
      minPublicationDate: { $min: '$publication_date' },
      maxPublicationDate: { $max: '$publication_date' }
    }
  }
]).toArray();

if (dateStats.length > 0) {
  const stats = dateStats[0];
  print(`Date range (date field): ${stats.minDate} to ${stats.maxDate}`);
  if (stats.minPublicationDate) {
    print(`Publication date range: ${stats.minPublicationDate} to ${stats.maxPublicationDate}`);
  }
}

// Count documents with relationships/citations
print("\n=== Relationship Statistics ===");
const withRelaciones = collection.countDocuments({ relaciones: { $exists: true, $ne: [] } });
const withCitas = collection.countDocuments({ citas: { $exists: true, $ne: [] } });
const withReferencias = collection.countDocuments({ referencias_normativas: { $exists: true, $ne: [] } });
print(`Documents with relaciones: ${withRelaciones}`);
print(`Documents with citas: ${withCitas}`);
print(`Documents with referencias_normativas: ${withReferencias}`);

// Analyze by tribunal if exists
if (sample && sample.tribunal !== undefined) {
  print("\n=== Documents by Tribunal ===");
  const tribunales = collection.aggregate([
    {
      $group: {
        _id: '$tribunal',
        count: { $sum: 1 }
      }
    },
    {
      $sort: { count: -1 }
    },
    {
      $limit: 20
    }
  ]).toArray();
  
  print("Top 20 Tribunales:");
  tribunales.forEach(t => {
    print(`  ${t._id || 'null/undefined'}: ${t.count} documents`);
  });
}

print("\n=== Analysis Complete ===");

