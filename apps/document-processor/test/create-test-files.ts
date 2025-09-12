#!/usr/bin/env tsx

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import XLSX from 'xlsx';
import JSZip from 'jszip';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const TEST_FILES_DIR = path.join(__dirname, '..', 'test_files');

// Create test files directory
if (!fs.existsSync(TEST_FILES_DIR)) {
  fs.mkdirSync(TEST_FILES_DIR, { recursive: true });
}

console.log('Creating test files in:', TEST_FILES_DIR);

/**
 * Create a simple PDF (using a minimal approach)
 */
function createSimplePDF(filename: string, text: string) {
  // For now, we'll create a simple text file that simulates a PDF
  // In a real scenario, you'd use pdf-lib or similar
  const content = `%PDF-1.4
1 0 obj
<<
/Type /Catalog
/Pages 2 0 R
>>
endobj

2 0 obj
<<
/Type /Pages
/Kids [3 0 R]
/Count 1
>>
endobj

3 0 obj
<<
/Type /Page
/Parent 2 0 R
/MediaBox [0 0 612 792]
/Contents 4 0 R
/Resources <<
/Font <<
/F1 5 0 R
>>
>>
>>
endobj

4 0 obj
<<
/Length ${text.length + 20}
>>
stream
BT
/F1 12 Tf
72 720 Td
(${text}) Tj
ET
endstream
endobj

5 0 obj
<<
/Type /Font
/Subtype /Type1
/BaseFont /Helvetica
>>
endobj

xref
0 6
0000000000 65535 f
0000000009 00000 n
0000000058 00000 n
0000000115 00000 n
0000000274 00000 n
0000000411 00000 n
trailer
<<
/Size 6
/Root 1 0 R
>>
startxref
499
%%EOF`;

  fs.writeFileSync(path.join(TEST_FILES_DIR, filename), content);
  console.log(`✓ Created ${filename}`);
}

/**
 * Create a text file of specified size
 */
function createLargeTextFile(filename: string, sizeInMB: number) {
  const chunkSize = 1024 * 1024; // 1MB chunks
  const totalSize = sizeInMB * 1024 * 1024;
  const linesPerChunk = 10000;
  const lineContent = 'This is a test line with some content that will be repeated many times to create a large file. ';

  const filePath = path.join(TEST_FILES_DIR, filename);
  const stream = fs.createWriteStream(filePath);

  let written = 0;

  while (written < totalSize) {
    const lines: string[] = [];
    for (let i = 0; i < linesPerChunk && written < totalSize; i++) {
      const line = `${written + i}: ${lineContent.repeat(5)}\n`;
      lines.push(line);
      written += Buffer.byteLength(line, 'utf8');
    }

    stream.write(lines.join(''));

    if (written % (10 * 1024 * 1024) === 0) { // Log every 10MB
      console.log(`  Written ${(written / (1024 * 1024)).toFixed(1)}MB / ${sizeInMB}MB`);
    }
  }

  stream.end();
  console.log(`✓ Created ${filename} (${sizeInMB}MB)`);
}

/**
 * Create a large XLSX file with many rows and columns
 */
function createLargeXLSX(filename: string, numRows: number, numCols: number) {
  const workbook = XLSX.utils.book_new();
  const worksheet: any[][] = [];

  // Create header row
  const headerRow: any[] = [];
  for (let col = 0; col < numCols; col++) {
    headerRow.push(`Column_${col}`);
  }
  worksheet.push(headerRow);

  // Create data rows
  for (let row = 1; row <= numRows; row++) {
    const dataRow: any[] = [];
    for (let col = 0; col < numCols; col++) {
      dataRow.push(`Row${row}_Col${col}`);
    }
    worksheet.push(dataRow);
  }

  const sheet = XLSX.utils.aoa_to_sheet(worksheet);
  XLSX.utils.book_append_sheet(workbook, sheet, 'LargeSheet');

  XLSX.writeFile(workbook, path.join(TEST_FILES_DIR, filename));
  console.log(`✓ Created ${filename} (${numRows} rows x ${numCols} columns)`);
}

/**
 * Create a PPTX file with many slides
 */
async function createLargePPTX(filename: string, numSlides: number) {
  const zip = new JSZip();

  // Create PPTX structure
  zip.file('[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="xml" ContentType="application/xml"/>
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/>
  <Override PartName="/ppt/slides/slide1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>
</Types>`);

  // Create presentation.xml
  zip.file('ppt/presentation.xml', `<?xml version="1.0" encoding="UTF-8"?>
<p:presentation xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:sldIdLst>
    ${Array.from({ length: numSlides }, (_, i) => `<p:sldId id="${i + 256}" r:id="rId${i + 1}"/>`).join('\n    ')}
  </p:sldIdLst>
</p:presentation>`);

  // Create slides
  for (let i = 1; i <= numSlides; i++) {
    const slideContent = `<?xml version="1.0" encoding="UTF-8"?>
<p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:cSld>
    <p:spTree>
      <p:nvGrpSpPr>
        <p:cNvPr id="1" name=""/>
        <p:cNvGrpSpPr/>
        <p:nvPr/>
      </p:nvGrpSpPr>
      <p:grpSpPr>
        <a:xfrm>
          <a:off x="0" y="0"/>
          <a:ext cx="0" cy="0"/>
          <a:chOff x="0" y="0"/>
          <a:chExt cx="0" cy="0"/>
        </a:xfrm>
      </p:grpSpPr>
      <p:sp>
        <p:nvSpPr>
          <p:cNvPr id="2" name="Title"/>
          <p:cNvSpPr>
            <a:solidFill>
              <a:srgbClr val="FFFFFF"/>
            </a:solidFill>
          </p:cNvSpPr>
          <p:nvPr>
            <p:ph type="title"/>
          </p:nvPr>
        </p:nvSpPr>
        <p:spPr/>
        <p:txBody>
          <a:bodyPr/>
          <a:lstStyle/>
          <a:p>
            <a:r>
              <a:rPr lang="en-US" sz="4400" b="1"/>
              <a:t>Slide ${i} - ${'Test content '.repeat(50)}</a:t>
            </a:r>
          </a:p>
        </p:txBody>
      </p:sp>
    </p:spTree>
  </p:cSld>
</p:sld>`;

    zip.file(`ppt/slides/slide${i}.xml`, slideContent);
  }

  // Generate and save the ZIP file
  const buffer = await zip.generateAsync({ type: 'nodebuffer' });
  fs.writeFileSync(path.join(TEST_FILES_DIR, filename), buffer);
  console.log(`✓ Created ${filename} (${numSlides} slides)`);
}

/**
 * Create a CSV file with many rows
 */
function createLargeCSV(filename: string, numRows: number, numCols: number) {
  const filePath = path.join(TEST_FILES_DIR, filename);
  const stream = fs.createWriteStream(filePath);

  // Write header
  const header = Array.from({ length: numCols }, (_, i) => `Column_${i}`).join(',');
  stream.write(header + '\n');

  // Write data rows
  for (let row = 1; row <= numRows; row++) {
    const dataRow = Array.from({ length: numCols }, (_, col) => `"Row${row}_Col${col}_Data"`).join(',');
    stream.write(dataRow + '\n');

    if (row % 10000 === 0) {
      console.log(`  Written ${row}/${numRows} rows`);
    }
  }

  stream.end();
  console.log(`✓ Created ${filename} (${numRows} rows x ${numCols} columns)`);
}

/**
 * Create a simple audio file (mock - just a text file for testing)
 */
function createMockAudioFile(filename: string, sizeInMB: number) {
  const content = Buffer.alloc(sizeInMB * 1024 * 1024, 0xFF); // Fill with dummy data
  fs.writeFileSync(path.join(TEST_FILES_DIR, filename), content);
  console.log(`✓ Created mock ${filename} (${sizeInMB}MB)`);
}

// Create all test files
async function createAllTestFiles() {
  console.log('\n🚀 Creating test files...\n');

  try {
    // Basic valid files
    createSimplePDF('valid-small.pdf', 'This is a small test PDF');
    createLargeTextFile('valid-medium.txt', 5); // 5MB
    createLargeCSV('valid-medium.csv', 50000, 10); // 50K rows

    // Files that test limits
    console.log('\n📏 Creating files that test limits...\n');

    // Large files (should be rejected)
    createLargeTextFile('too-large.txt', 120); // 120MB (over 100MB limit)
    createLargeCSV('too-large.csv', 200000, 20); // 200K rows (over 100K limit)
    createLargeXLSX('too-large.xlsx', 20000, 50); // 20K rows (over 10K limit)

    // Office files with many elements
    createLargeXLSX('large-spreadsheet.xlsx', 15000, 30); // Should be truncated
    await createLargePPTX('large-presentation.pptx', 150); // Should be truncated

    // Unsupported files (should be rejected)
    fs.writeFileSync(path.join(TEST_FILES_DIR, 'unsupported.xyz'), 'This is an unsupported file type');

    // Mock audio/video files
    createMockAudioFile('test-audio.mp3', 10); // 10MB (within limits)
    createMockAudioFile('too-large-audio.mp3', 600); // 600MB (over 500MB limit)

    console.log('\n✅ All test files created successfully!');
    console.log(`📁 Test files location: ${TEST_FILES_DIR}`);
    console.log('\n📋 Test file summary:');
    console.log('  ✓ Valid files (should process successfully)');
    console.log('  ✓ Large files (should be truncated or rejected)');
    console.log('  ✓ Unsupported formats (should be rejected)');
    console.log('\n🔧 Run tests with: npm run test');

  } catch (error) {
    console.error('❌ Error creating test files:', error);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  createAllTestFiles();
}

export { createAllTestFiles };
