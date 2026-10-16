import { createRequire } from 'node:module';

const requireFromDb = createRequire(new URL('../lib/db/package.json', import.meta.url));
const { Pool } = requireFromDb('pg');

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL must be set. Run this with --env-file-if-exists=.env.local.');
}

const verifiedOn = '2026-10-16';
const categories = [
  {
    name: 'Computers & Laptops',
    slug: 'computers-laptops',
    description: 'Business laptops and computing equipment listed by CRITS Limited.',
  },
  {
    name: 'Printers, Copiers & Scanners',
    slug: 'printers-copiers-scanners',
    description: 'Office printers, photocopiers and multifunction equipment.',
  },
  {
    name: 'Printer Supplies & Accessories',
    slug: 'printer-supplies-accessories',
    description: 'Toner cartridges, imaging drums and accessories for printers and copiers.',
  },
];

const products = [
  {
    slug: 'lenovo-thinkpad-t495s-laptop',
    title: 'Lenovo ThinkPad T495s 14-inch Laptop',
    brand: 'Lenovo',
    model: 'ThinkPad T495s',
    category: 'computers-laptops',
    condition: 'used',
    description: 'A fairly used 14-inch Lenovo ThinkPad with an AMD Ryzen 5 processor, 8 GB RAM and a 256 GB SSD. The listing states Windows 11 and a black finish.',
    specifications: {
      'Display size': '14 inches',
      'Processor': 'AMD Ryzen 5, hexa-core',
      'Memory': '8 GB RAM',
      'Storage': '256 GB SSD',
      'Operating system': 'Windows 11',
      'Colour': 'Black',
    },
    imageUrls: ['https://pictures-uganda.jijistatic.com/30709227_NjIwLTU3MC02NGI5YTExYTg4.webp'],
    priceUgx: 900000,
    featured: true,
    sourceListingUrl: 'https://jiji.ug/central-division/computers-and-laptops/laptop-lenovo-thinkpad-t495s-8gb-amd-ryzen-5-ssd-256gb-ajiwylm7cEGBVPQx2jo1gAXr.html',
  },
  {
    slug: 'konica-minolta-bizhub-c258-copier',
    title: 'Konica Minolta Bizhub C258 A3 Colour Copier',
    brand: 'Konica Minolta',
    model: 'Bizhub C258',
    category: 'printers-copiers-scanners',
    condition: 'refurbished',
    description: 'Refurbished A3 colour multifunction copier. Contact CRITS to confirm the current configuration, included accessories and availability.',
    specifications: { 'Paper size': 'A3', 'Output': 'Colour', 'Condition': 'Refurbished' },
    imageUrls: ['https://pictures-uganda.jijistatic.com/30346897_NjIwLTgyOC04MjQwYjAwNzBl.webp'],
    priceUgx: 3700000,
    featured: true,
    sourceListingUrl: 'https://jiji.ug/central-division/printers-and-scanners/konica-minolta-bizhub-c258-2vvOok6sUoRJVE1CxCMvlFNv.html',
  },
  {
    slug: 'kyocera-taskalfa-5002s-a3-mono-copier',
    title: 'Kyocera TASKalfa 5002s A3 Monochrome Copier',
    brand: 'Kyocera',
    model: 'TASKalfa 5002s',
    category: 'printers-copiers-scanners',
    condition: 'refurbished',
    description: 'Refurbished, high-volume A3 monochrome multifunction copier with print, scan and copy functions. The listing specifies up to 50 pages per minute, 1200 dpi resolution, USB and RJ45 connectivity, and expandable paper capacity.',
    specifications: {
      'Print speed': 'Up to 50 pages per minute',
      'Resolution': '1200 dpi',
      'Supported paper': 'A3, A4, A5, A6',
      'Connectivity': 'USB, RJ45 and other',
      'Output': 'Black and white',
      'Condition': 'Refurbished',
    },
    imageUrls: [],
    priceUgx: 3000000,
    featured: true,
    sourceListingUrl: 'https://jiji.ug/sw/central-division/printers-and-scanners/kyocera-taskalfa-5002s-a3-black-white-multifunctional-printer-xgMJWWFFIMt7j74LawU24cdC.html',
  },
  {
    slug: 'kyocera-taskalfa-7002i-a3-mono-mfp',
    title: 'Kyocera TASKalfa 7002i A3 Monochrome MFP',
    brand: 'Kyocera',
    model: 'TASKalfa 7002i',
    category: 'printers-copiers-scanners',
    condition: 'refurbished',
    description: 'Refurbished enterprise A3 monochrome copier, scanner and printer with finisher. The listing highlights print speeds up to 70 pages per minute, 1200 × 1200 dpi output and scalable high-capacity paper handling.',
    specifications: {
      'Print speed': 'Up to 70 pages per minute',
      'Resolution': '1200 × 1200 dpi',
      'Supported paper': 'A3, A4, A5, A6',
      'Connectivity': 'Wi-Fi, USB and other',
      'Output': 'Black and white',
      'Condition': 'Refurbished',
    },
    imageUrls: [],
    priceUgx: 6100000,
    featured: false,
    sourceListingUrl: 'https://jiji.ug/arua/printers-and-scanners/kyocera-taskalfa-7002i-mono-mfp-a3-copier-scanner-finisher-3JVp0Z4OrKMizMp8WRltqqR3.html',
  },
  {
    slug: 'brother-dcp-l2540dw-laser-multifunction-printer',
    title: 'Brother DCP-L2540DW Monochrome Laser Printer',
    brand: 'Brother',
    model: 'DCP-L2540DW',
    category: 'printers-copiers-scanners',
    condition: 'new',
    description: 'New A4 monochrome laser multifunction printer with print, scan and copy functions. The listing describes 30 pages per minute, automatic duplex printing, a 35-sheet document feeder, Wi-Fi, USB and Ethernet.',
    specifications: {
      'Print speed': 'Up to 30 pages per minute',
      'Functions': 'Print, scan and copy',
      'Paper size': 'A4',
      'Duplex': 'Automatic two-sided printing',
      'Document feeder': '35-sheet ADF',
      'Connectivity': 'USB, Wi-Fi and RJ45',
    },
    imageUrls: [],
    priceUgx: 1000000,
    featured: true,
    sourceListingUrl: 'https://jiji.ug/sw/central-division/printers-and-scanners/brand-new-brother-dcp-l2540dw-printer-5Lum1THWVBc3qJ7tCzn29gqq.html',
  },
  {
    slug: 'hp-120a-w1120a-original-imaging-drum',
    title: 'HP 120A (W1120A) Original Imaging Drum',
    brand: 'HP',
    model: '120A / W1120A',
    category: 'printer-supplies-accessories',
    condition: 'new',
    description: 'Original HP laser imaging drum for compatible HP Color Laser 150 and 170 series printers. The listing gives an approximate yield of 16,000 monochrome pages and 4,000 colour pages.',
    specifications: {
      'Part number': 'W1120A',
      'Compatible printers': 'HP Color Laser 150 and 170 series',
      'Approx. yield': '16,000 monochrome / 4,000 colour pages',
      'Condition': 'Brand new',
    },
    imageUrls: ['https://pictures-uganda.jijistatic.com/28021842_NjIwLTQ2NS0xYTZjMjE4ODUw.webp'],
    priceUgx: 570000,
    featured: false,
    sourceListingUrl: 'https://jiji.ug/central-division/accessories-and-supplies-for-electronics/hp-120a-w1120a-original-drum-unit-8Wx4VOmnAUoJowe3Do19bQxn.html',
  },
  {
    slug: 'hp-147a-w1470a-original-black-toner',
    title: 'HP 147A (W1470A) Original Black Toner Cartridge',
    brand: 'HP',
    model: '147A / W1470A',
    category: 'printer-supplies-accessories',
    condition: 'new',
    description: 'Original black HP LaserJet toner cartridge. The listing names compatible Enterprise Flow MFP and M610, M611 and M612 series printers, with an approximate yield of 10,500 pages.',
    specifications: {
      'Part number': 'W1470A',
      'Colour': 'Black',
      'Approx. yield': '10,500 pages',
      'Compatible printers': 'Selected HP LaserJet Enterprise M610–M612 and M634–M636 models',
      'Condition': 'Brand new',
    },
    imageUrls: ['https://pictures-uganda.jijistatic.com/27954859_NjIwLTgyNy03N2U3N2E2OTk1.webp'],
    priceUgx: 800000,
    featured: false,
    sourceListingUrl: 'https://jiji.ug/central-division/accessories-and-supplies-for-electronics/hp-147a-w1470a-original-laserjet-toner-cartridge-black-ntGj2fUZe2GooEH1XcmdoDHM.html',
  },
  {
    slug: 'hp-35a-cb435a-black-toner-cartridge',
    title: 'HP 35A (CB435A) Black Toner Cartridge',
    brand: 'HP',
    model: '35A / CB435A',
    category: 'printer-supplies-accessories',
    condition: 'new',
    description: 'Genuine black HP laser toner cartridge for the LaserJet P1005 and P1006. The listing gives an approximate yield of 1,500 pages.',
    specifications: {
      'Part number': 'CB435A',
      'Colour': 'Black',
      'Compatible printers': 'HP LaserJet P1005 and P1006',
      'Approx. yield': '1,500 pages',
      'Condition': 'Brand new',
    },
    imageUrls: ['https://pictures-uganda.jijistatic.com/27976260_NjIwLTgyNy0yMGVhZTU2Yzcx.webp'],
    priceUgx: 250000,
    featured: false,
    sourceListingUrl: 'https://jiji.ug/central-division/accessories-and-supplies-for-electronics/genuine-hp-35a-black-toner-cartridge-8kxY28qNMGPh5ozuNlBXG4OA.html',
  },
  {
    slug: 'canon-067-067h-toner-cartridges',
    title: 'Canon 067 / 067H Toner Cartridges',
    brand: 'Canon',
    model: '067 / 067H',
    category: 'printer-supplies-accessories',
    condition: 'new',
    description: 'Genuine Canon toner cartridges available in black, cyan, magenta and yellow. The listing distinguishes standard yield from the higher-yield 067H versions and gives a reduced unit price for orders of two or more.',
    specifications: {
      'Available colours': 'Black, cyan, magenta and yellow',
      'Standard yield': 'Up to 1,350 black / 1,250 colour pages',
      '067H yield': 'Up to 3,130 black / 2,350 colour pages',
      'Bulk price': 'UGX 390,000 each for 2 or more',
      'Condition': 'Brand new',
    },
    imageUrls: ['https://pictures-uganda.jijistatic.com/27941371_NjIwLTQ1MC0yNjlhN2ZmZjYz.webp'],
    priceUgx: 400000,
    featured: false,
    sourceListingUrl: 'https://jiji.ug/central-division/accessories-and-supplies-for-electronics/genuine-canon-067-067h-toner-cartridges-3XksVcAQMyXPdEfajKVGc8et.html',
  },
  {
    slug: 'hp-222a-colour-toner-cartridge',
    title: 'HP 222A Colour Toner Cartridge',
    brand: 'HP',
    model: '222A',
    category: 'printer-supplies-accessories',
    condition: 'new',
    description: 'HP 222A colour laser toner cartridge range for compatible HP Color LaserJet Pro models. The listing describes black, cyan, magenta and yellow options and approximate yields of 1,300 black pages and 1,200 colour pages.',
    specifications: {
      'Part numbers': 'W2220A black, W2221A cyan, W2222A yellow, W2223A magenta',
      'Approx. yield': 'Up to 1,300 black / 1,200 colour pages',
      'Compatible printers': 'Selected HP Color LaserJet Pro 3203 and 3303 models',
      'Condition': 'Brand new',
    },
    imageUrls: ['https://pictures-uganda.jijistatic.com/27882005_NjIwLTgyNy1kYmFiNGM1ZmZj.webp'],
    priceUgx: 400000,
    featured: false,
    sourceListingUrl: 'https://jiji.ug/central-division/accessories-and-supplies-for-electronics/hp-222a-color-toner-cartridge-8i2Z5oz748g4d78mpPKPhGkb.html',
  },
  {
    slug: 'hp-55a-ce255a-black-toner-cartridge',
    title: 'HP 55A (CE255A) Black Toner Cartridge',
    brand: 'HP',
    model: '55A / CE255A',
    category: 'printer-supplies-accessories',
    condition: 'new',
    description: 'Genuine HP black toner for compatible LaserJet Enterprise 525, P3015 and LaserJet Pro M521 printers. The listing gives an approximate yield of 6,000 pages.',
    specifications: {
      'Part number': 'CE255A',
      'Colour': 'Black',
      'Approx. yield': '6,000 pages',
      'Compatible printers': 'HP LaserJet Enterprise 525, P3015 and LaserJet Pro M521',
      'Condition': 'Brand new',
    },
    imageUrls: ['https://pictures-uganda.jijistatic.com/27927466_NjIwLTQ2NS0wMzkwYjc2MmE4.webp'],
    priceUgx: 400000,
    featured: false,
    sourceListingUrl: 'https://jiji.ug/central-division/accessories-and-supplies-for-electronics/genuine-hp-laserjet-55a-ce255a-black-toner-cartridge-xiGb8mQJl3hAH5vdO71QlZrZ.html',
  },
  {
    slug: 'hp-compatible-207a-toner-with-chip',
    title: 'Compatible HP 207A Toner Cartridge with Chip',
    brand: 'HP',
    model: '207A',
    category: 'printer-supplies-accessories',
    condition: 'new',
    description: 'Compatible 207A toner set with replacement chips included. The listing names compatible HP Color LaserJet Pro M255, M282 and M283 models and gives a reduced unit price for orders of two or more.',
    specifications: {
      'Part family': 'HP 207A',
      'Chip': 'Included',
      'Compatible printers': 'HP Color LaserJet Pro M255, M282 and M283 series',
      'Bulk price': 'UGX 190,000 each for 2 or more',
      'Condition': 'Brand new',
    },
    imageUrls: [],
    priceUgx: 200000,
    featured: false,
    sourceListingUrl: 'https://jiji.ug/sw/central-division/accessories-and-supplies-for-electronics/compatible-toner-cartridge-207a-with-chip-Bz1Vk3u4DsXCuhZmqGaUduqj.html',
  },
  {
    slug: 'canon-c-exv-49-toner-cartridges',
    title: 'Canon C-EXV 49 Toner Cartridge',
    brand: 'Canon',
    model: 'C-EXV 49',
    category: 'printer-supplies-accessories',
    condition: 'new',
    description: 'Genuine Canon C-EXV 49 toner cartridge for compatible Canon imageRUNNER ADVANCE series printers. Contact CRITS to confirm compatible device models and current availability.',
    specifications: { 'Part number': 'C-EXV 49', 'Compatible printers': 'Canon imageRUNNER ADVANCE series', 'Condition': 'Brand new' },
    imageUrls: [],
    priceUgx: 470000,
    featured: false,
    sourceListingUrl: 'https://jiji.ug/sw/central-division/accessories-and-supplies-for-electronics/genuine-canon-c-exv-49-toner-cartridges-53G49uqoGqzBDqa99IayEFfm.html',
  },
];

const pool = new Pool({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 5000 });
const client = await pool.connect();

try {
  await client.query('BEGIN');
  const categoryIds = new Map();
  for (const category of categories) {
    const result = await client.query(
      `INSERT INTO crits_categories (name, slug, description, active)
       VALUES ($1, $2, $3, true)
       ON CONFLICT (slug) DO UPDATE SET
         name = EXCLUDED.name,
         description = EXCLUDED.description,
         active = true,
         updated_at = now()
       RETURNING id, slug`,
      [category.name, category.slug, category.description],
    );
    categoryIds.set(result.rows[0].slug, result.rows[0].id);
  }

  for (const product of products) {
    const categoryId = categoryIds.get(product.category);
    if (!categoryId) throw new Error(`Missing category ${product.category} for ${product.slug}`);
    await client.query(
      `INSERT INTO crits_products (
         slug, title, brand, model, category_id, condition, description,
         specifications, image_urls, price_ugx, availability, stock_quantity,
         source_listing_url, source_verified_at, status, featured
       ) VALUES (
         $1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9::text[], $10,
         'available', NULL, $11, $12::date, 'published', $13
       )
       ON CONFLICT (slug) DO UPDATE SET
         title = EXCLUDED.title,
         brand = EXCLUDED.brand,
         model = EXCLUDED.model,
         category_id = EXCLUDED.category_id,
         condition = EXCLUDED.condition,
         description = EXCLUDED.description,
         specifications = EXCLUDED.specifications,
         image_urls = EXCLUDED.image_urls,
         price_ugx = EXCLUDED.price_ugx,
         availability = EXCLUDED.availability,
         source_listing_url = EXCLUDED.source_listing_url,
         source_verified_at = EXCLUDED.source_verified_at,
         status = 'published',
         featured = EXCLUDED.featured,
         updated_at = now()`,
      [
        product.slug,
        product.title,
        product.brand,
        product.model,
        categoryId,
        product.condition,
        product.description,
        JSON.stringify(product.specifications),
        product.imageUrls,
        product.priceUgx,
        product.sourceListingUrl,
        verifiedOn,
        product.featured,
      ],
    );
  }
  await client.query('COMMIT');
  console.log(`Imported ${products.length} published Jiji listings into ${categories.length} active categories.`);
} catch (error) {
  await client.query('ROLLBACK');
  throw error;
} finally {
  client.release();
  await pool.end();
}
