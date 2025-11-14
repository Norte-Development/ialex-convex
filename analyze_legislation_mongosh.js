// MongoDB analysis script for ialex_legislation_ar database using mongosh
use('ialex_legislation_ar');

const collection = db.getCollection('ialex_legislation_ar');

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

// Analyze by type if exists
if (sample && sample.type !== undefined) {
  print("\n=== Documents by Type ===");
  const types = collection.aggregate([
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
  
  types.forEach(t => {
    print(`${t._id || 'null/undefined'}: ${t.count} documents`);
  });
}

// Additional analysis: check for other relevant fields
print("\n=== Additional Field Analysis ===");

// Analyze by tipo_detalle
print("\n=== Documents by Tipo Detalle (Normative Type) ===");
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

// Analyze by estado
print("\n=== Documents by Estado (Status) ===");
const estados = collection.aggregate([
  {
    $group: {
      _id: '$estado',
      count: { $sum: 1 }
    }
  },
  {
    $sort: { count: -1 }
  }
]).toArray();

estados.forEach(e => {
  print(`  ${e._id || 'null/undefined'}: ${e.count} documents`);
});

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

// Detailed breakdown: Jurisdiction + Tipo Detalle
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
  print(`Publication date range: ${stats.minPublicationDate} to ${stats.maxPublicationDate}`);
}

// Count documents with relationships
print("\n=== Relationship Statistics ===");
const withRelaciones = collection.countDocuments({ relaciones: { $exists: true, $ne: [] } });
const withRelacionesSalientes = collection.countDocuments({ relaciones_salientes: { $exists: true, $ne: [] } });
const withCitas = collection.countDocuments({ citas: { $exists: true, $ne: [] } });
print(`Documents with relaciones: ${withRelaciones}`);
print(`Documents with relaciones_salientes: ${withRelacionesSalientes}`);
print(`Documents with citas: ${withCitas}`);

print("\n=== Analysis Complete ===");

