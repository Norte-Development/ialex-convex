#!/usr/bin/env node

import { MongoClient } from 'mongodb';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { NormativeDoc, Relacion, NormativeChunk } from '../types/legislation';

// Sample legislation data for testing
const sampleNormatives: NormativeDoc[] = [
  // Argentina Federal
  {
    id: "ley_20744_argentina",
    tipo: "Ley",
    numero: "20744",
    titulo: "Ley de Contrato de Trabajo",
    provincia: 'nacional', // Federal
    promulgacion: "1974-05-13",
    estado: "vigente",
    vigencia_actual: true,
    resumen: "Regula las relaciones laborales entre empleadores y trabajadores en Argentina",
    texto: "La presente ley regula las relaciones laborales entre empleadores y trabajadores...",
    relaciones: [
      {
        target_id: "ley_24013_argentina",
        tipo: "modifica",
        alcance: "parcial",
        articulo: "Artículo 1",
        confidence: 0.95,
        textual_cita: "Modificada por Ley 24.013"
      }
    ],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    id: "ley_24013_argentina",
    tipo: "Ley",
    numero: "24013",
    titulo: "Modificación a la Ley de Contrato de Trabajo",
    provincia: 'nacional',
    promulgacion: "1991-12-23",
    estado: "vigente",
    vigencia_actual: true,
    resumen: "Modifica aspectos específicos de la Ley de Contrato de Trabajo",
    texto: "Se modifica la Ley 20.744...",
    relaciones: [
      {
        target_id: "ley_20744_argentina",
        tipo: "es_modificada_por",
        alcance: "parcial",
        articulo: "Artículo 1",
        confidence: 0.95,
        textual_cita: "Modifica Ley 20.744"
      }
    ],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    id: "codigo_civil_comercial_argentina",
    tipo: "Código",
    titulo: "Código Civil y Comercial de la Nación",
    provincia: 'nacional',
    promulgacion: "2014-10-01",
    estado: "vigente",
    vigencia_actual: true,
    resumen: "Código que unifica el derecho civil y comercial argentino",
    texto: "El presente Código regula las relaciones jurídicas privadas...",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },

  // Buenos Aires Province
  {
    id: "ley_1234_buenos_aires",
    tipo: "Ley Provincial",
    numero: "1234",
    titulo: "Ley de Protección al Consumidor de Buenos Aires",
    provincia: "Buenos Aires",
    promulgacion: "2018-03-15",
    estado: "vigente",
    vigencia_actual: true,
    resumen: "Protege los derechos de los consumidores en la provincia de Buenos Aires",
    texto: "La presente ley tiene por objeto proteger los derechos de los consumidores...",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    id: "decreto_567_buenos_aires",
    tipo: "Decreto",
    numero: "567",
    titulo: "Reglamentación de la Ley de Protección al Consumidor",
    provincia: "Buenos Aires",
    promulgacion: "2018-06-20",
    estado: "vigente",
    vigencia_actual: true,
    resumen: "Reglamenta la aplicación de la ley provincial de protección al consumidor",
    texto: "En ejercicio de las facultades conferidas por la Ley 1234...",
    relaciones: [
      {
        target_id: "ley_1234_buenos_aires",
        tipo: "reglamenta",
        alcance: "total",
        confidence: 0.98,
        textual_cita: "Reglamenta Ley Provincial 1234"
      }
    ],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },

  // Córdoba Province
  {
    id: "ley_890_cordoba",
    tipo: "Ley Provincial",
    numero: "890",
    titulo: "Ley de Educación de Córdoba",
    provincia: "Córdoba",
    promulgacion: "2015-11-10",
    estado: "vigente",
    vigencia_actual: true,
    resumen: "Establece el sistema educativo provincial de Córdoba",
    texto: "La educación es un derecho humano fundamental...",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },

  // Santa Fe Province
  {
    id: "constitucion_santa_fe",
    tipo: "Constitución Provincial",
    titulo: "Constitución de la Provincia de Santa Fe",
    provincia: "Santa Fe",
    promulgacion: "1962-06-20",
    estado: "vigente",
    vigencia_actual: true,
    resumen: "Carta magna de la provincia de Santa Fe",
    texto: "Nos los representantes del pueblo de la Provincia de Santa Fe...",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },

  // Some outdated/invalid entries for testing
  {
    id: "ley_antigua_derogada",
    tipo: "Ley",
    numero: "123",
    titulo: "Ley Antigua Derogada",
    provincia: 'nacional',
    promulgacion: "1900-01-01",
    estado: "derogada",
    vigencia_actual: false,
    resumen: "Esta ley ha sido derogada y ya no está en vigor",
    texto: "Esta es una ley antigua que ha sido derogada...",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }
];

// Sample chunks for vector search testing
const sampleChunks: NormativeChunk[] = [
  {
    normative_id: "ley_20744_argentina",
    chunk_index: 0,
    article: "Artículo 1",
    section: "Capítulo I",
    text: "La presente ley regula las relaciones laborales entre empleadores y trabajadores en Argentina. Establece los derechos y obligaciones de ambas partes en el contrato de trabajo."
  },
  {
    normative_id: "ley_20744_argentina",
    chunk_index: 1,
    article: "Artículo 2",
    section: "Capítulo I",
    text: "Se considera empleador a toda persona física o jurídica que recibe servicios de un trabajador. El empleador debe garantizar condiciones dignas de trabajo."
  },
  {
    normative_id: "codigo_civil_comercial_argentina",
    chunk_index: 0,
    article: "Artículo 1",
    section: "Libro I",
    text: "El presente Código regula las relaciones jurídicas privadas, tanto de carácter civil como comercial. Unifica los códigos civil y comercial en un solo cuerpo normativo."
  },
  {
    normative_id: "ley_1234_buenos_aires",
    chunk_index: 0,
    article: "Artículo 1",
    section: "Título I",
    text: "Los consumidores tienen derecho a la protección de su salud, seguridad e intereses económicos. Esta ley establece las normas para la protección de estos derechos."
  }
];

async function seedLegislationData() {
  const mongoUri = "mongodb://root:iAlex-mongodb@31.97.20.213:5432/?directConnection=true"
  const dbName = process.env.MONGODB_DB_NAME || 'ialex_legislation';

  if (!mongoUri) {
    console.error('❌ MONGODB_URI environment variable is not set');
    process.exit(1);
  }

  const client = new MongoClient(mongoUri);

  try {
    console.log('🔄 Connecting to MongoDB...');
    await client.connect();
    console.log('✅ Connected to MongoDB');

    const db = client.db(dbName);

    // Define jurisdictions to seed
    const jurisdictions = ['argentina', 'buenos_aires', 'cordoba', 'santa_fe'];

    for (const jurisdiction of jurisdictions) {
      console.log(`\n🌱 Seeding data for jurisdiction: ${jurisdiction}`);

      // Filter normatives for this jurisdiction
      const jurisdictionNormatives = sampleNormatives.filter(normative => {
        if (jurisdiction === 'argentina') {
          return !normative.provincia; // Federal laws
        }
        return normative.provincia?.toLowerCase().replace(/\s+/g, '_') === jurisdiction;
      });

      if (jurisdictionNormatives.length === 0) {
        console.log(`⚠️ No normatives found for jurisdiction: ${jurisdiction}`);
        continue;
      }

      // Insert normatives
      const collectionName = `legislacion_${jurisdiction}`;
      const collection = db.collection(collectionName);

      console.log(`📝 Inserting ${jurisdictionNormatives.length} normatives into ${collectionName}...`);

      // Clear existing data first
      await collection.deleteMany({});
      const result = await collection.insertMany(jurisdictionNormatives);

      console.log(`✅ Inserted ${result.insertedCount} normatives into ${collectionName}`);

      // Create indexes for better query performance
      await collection.createIndex({ tipo: 1 });
      await collection.createIndex({ provincia: 1 });
      await collection.createIndex({ estado: 1 });
      await collection.createIndex({ vigencia_actual: 1 });
      await collection.createIndex({ promulgacion: 1 });
      await collection.createIndex({ id: 1 }, { unique: true });

      console.log(`✅ Created indexes for ${collectionName}`);
    }

    // Insert some sample chunks for vector search testing (Argentina jurisdiction)
    console.log('\n🔍 Inserting sample chunks for vector search testing...');
    const chunksCollection = db.collection('legislacion_argentina_chunks');

    // Clear existing chunks
    await chunksCollection.deleteMany({});
    const chunkResult = await chunksCollection.insertMany(sampleChunks);

    console.log(`✅ Inserted ${chunkResult.insertedCount} chunks for vector search testing`);

    // Create indexes for chunks
    await chunksCollection.createIndex({ normative_id: 1 });
    await chunksCollection.createIndex({ chunk_index: 1 });

    console.log('\n🎉 Legislation data seeding completed successfully!');
    console.log('\n📊 Summary:');
    console.log(`- Sample normatives: ${sampleNormatives.length}`);
    console.log(`- Sample chunks: ${sampleChunks.length}`);
    console.log(`- Jurisdictions: ${jurisdictions.join(', ')}`);

    console.log('\n🧪 You can now test the legislation service with:');
    console.log('- Search for "contrato de trabajo" to find labor laws');
    console.log('- Search for "consumidor" to find consumer protection laws');
    console.log('- Filter by jurisdiction: argentina, buenos_aires, cordoba, santa_fe');

  } catch (error) {
    console.error('❌ Error seeding legislation data:', error);
    process.exit(1);
  } finally {
    await client.close();
    console.log('🔌 Disconnected from MongoDB');
  }
}

// Run the seeding script
if (import.meta.url === `file://${process.argv[1]}`) {
  seedLegislationData().catch(console.error);
}

export { seedLegislationData };
