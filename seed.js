import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import {
  sequelize,
  User,
  Category,
  Supplier,
  Product,
  StockMovement,
} from "./models/index.js";

const daysAgo = (days, hour = 9) => {
  const date = new Date();
  date.setDate(date.getDate() - days);
  date.setHours(hour, 15, 0, 0);
  return date;
};

const categories = [
  ["Gallons", "5-gallon and 1-gallon returnable containers"],
  ["Bottled Water", "Ready-to-drink bottled water packs"],
  ["Caps", "Bottle caps and closures"],
  ["Seals", "Heat seals, shrink wrap and tamper seals"],
  ["Labels", "Brand labels and sticker seals"],
  ["Water Treatment", "Filters, membranes and mineral cartridges"],
  ["Cleaning & Sanitation", "Food-grade cleaning supplies"],
  ["Testing & Office", "Water testing kits and office consumables"],
];

// Older demo databases used these names; rename them instead of duplicating.
const legacyCategoryNames = {
  "Bottles & Containers": "Gallons",
  "Caps & Seals": "Caps",
};

const suppliers = [
  {
    name: "San Jose Packaging Supply",
    contactPerson: "Marlon Reyes",
    phone: "0917 555 0142",
    email: "sales@sanjosepackaging.ph",
    address: "San Jose, Occidental Mindoro",
    notes: "Bottles, caps, seals and labels. Delivers every Tuesday.",
  },
  {
    name: "AquaTech Water Solutions",
    contactPerson: "Liza Fernandez",
    phone: "0918 555 0288",
    email: "orders@aquatech.ph",
    address: "Calapan City, Oriental Mindoro",
    notes: "Filter cartridges, RO membranes and treatment parts.",
  },
  {
    name: "Mindoro Hygiene Depot",
    contactPerson: "Rico Bautista",
    phone: "0920 555 0119",
    email: "hello@mindorohygiene.ph",
    address: "Mamburao, Occidental Mindoro",
    notes: "Sanitizers, brushes and water testing supplies.",
  },
  {
    name: "Island Office Essentials",
    contactPerson: "Grace Lim",
    phone: "0922 555 0371",
    email: "grace@islandoffice.ph",
    address: "San Jose, Occidental Mindoro",
    notes: "Receipt paper and general office supplies.",
  },
];

const products = [
  {
    sku: "BTL-5G-SLIM",
    name: "5-Gallon Slim Bottle",
    category: "Gallons",
    supplier: "San Jose Packaging Supply",
    unit: "piece",
    openingQty: 180,
    outQty: 35,
    reorderLevel: 40,
    costPrice: 175,
    sellingPrice: 260,
    location: "Bottle rack A",
    description: "Food-grade PC bottle for returnable 5-gallon deliveries.",
  },
  {
    sku: "BTL-5G-ROUND",
    name: "5-Gallon Round Bottle",
    category: "Gallons",
    supplier: "San Jose Packaging Supply",
    unit: "piece",
    openingQty: 72,
    outQty: 0,
    reorderLevel: 24,
    costPrice: 195,
    sellingPrice: 280,
    location: "Bottle rack B",
    description: "Round profile bottle used for walk-in refills.",
  },
  {
    sku: "BTL-1G",
    name: "1-Gallon Bottle",
    category: "Gallons",
    supplier: "San Jose Packaging Supply",
    unit: "piece",
    openingQty: 48,
    outQty: 0,
    reorderLevel: 20,
    costPrice: 85,
    sellingPrice: 140,
    location: "Bottle rack B",
    description: "Small bottle for office and household refills.",
  },
  {
    sku: "CAP-BLUE",
    name: "Bottle Cap — Blue",
    category: "Caps",
    supplier: "San Jose Packaging Supply",
    unit: "piece",
    openingQty: 1200,
    outQty: 120,
    reorderLevel: 300,
    costPrice: 1.45,
    sellingPrice: 3,
    location: "Shelf C1",
    description: "Non-spill cap with AquaPiol blue finish.",
  },
  {
    sku: "SEAL-HEAT-5G",
    name: "Heat Seal — 5 Gallon",
    category: "Seals",
    supplier: "San Jose Packaging Supply",
    unit: "roll",
    openingQty: 24,
    outQty: 4,
    reorderLevel: 8,
    costPrice: 320,
    sellingPrice: 450,
    location: "Shelf C2",
    description: "Tamper-evident heat seal roll for 5-gallon bottles.",
  },
  {
    sku: "WRAP-SHRINK",
    name: "Shrink Wrap Roll",
    category: "Seals",
    supplier: "San Jose Packaging Supply",
    unit: "roll",
    openingQty: 12,
    outQty: 0,
    reorderLevel: 5,
    costPrice: 240,
    sellingPrice: 380,
    location: "Shelf C3",
    description: "Shrink wrap for bundled bottle deliveries.",
  },
  {
    sku: "BW-500-24",
    name: "Bottled Water 500ml (24-pack)",
    category: "Bottled Water",
    supplier: "San Jose Packaging Supply",
    unit: "pack",
    openingQty: 60,
    outQty: 12,
    reorderLevel: 15,
    costPrice: 210,
    sellingPrice: 300,
    location: "Front chiller",
    description: "Case of 24 ready-to-drink 500ml bottles for walk-in sales.",
  },
  {
    sku: "LBL-GALLON",
    name: "AquaPiol Gallon Label",
    category: "Labels",
    supplier: "San Jose Packaging Supply",
    unit: "piece",
    openingQty: 900,
    outQty: 80,
    reorderLevel: 250,
    costPrice: 0.85,
    sellingPrice: 2,
    location: "Shelf D1",
    description: "Waterproof gallon label with delivery hotline.",
  },
  {
    sku: "SEAL-STICKER",
    name: "AquaPiol Sticker Seal",
    category: "Labels",
    supplier: "San Jose Packaging Supply",
    unit: "piece",
    openingQty: 650,
    outQty: 50,
    reorderLevel: 200,
    costPrice: 0.65,
    sellingPrice: 1.5,
    location: "Shelf D2",
    description: "Tamper seal sticker applied after filling.",
  },
  {
    sku: "FLT-SED-10",
    name: "Sediment Filter 10\"",
    category: "Water Treatment",
    supplier: "AquaTech Water Solutions",
    unit: "piece",
    openingQty: 6,
    outQty: 2,
    reorderLevel: 6,
    costPrice: 95,
    sellingPrice: 180,
    location: "Treatment cabinet",
    description: "5-micron sediment cartridge for the first filtration stage.",
  },
  {
    sku: "FLT-CARB-10",
    name: "Carbon Block Filter 10\"",
    category: "Water Treatment",
    supplier: "AquaTech Water Solutions",
    unit: "piece",
    openingQty: 8,
    outQty: 3,
    reorderLevel: 5,
    costPrice: 135,
    sellingPrice: 240,
    location: "Treatment cabinet",
    description: "Carbon block cartridge for chlorine and odor removal.",
  },
  {
    sku: "MEM-RO-100",
    name: "RO Membrane 100 GPD",
    category: "Water Treatment",
    supplier: "AquaTech Water Solutions",
    unit: "piece",
    openingQty: 1,
    outQty: 0,
    reorderLevel: 2,
    costPrice: 1450,
    sellingPrice: 2200,
    location: "Locked cabinet",
    description: "100-gallon-per-day reverse osmosis membrane.",
  },
  {
    sku: "MIN-CART",
    name: "Mineral Cartridge",
    category: "Water Treatment",
    supplier: "AquaTech Water Solutions",
    unit: "piece",
    openingQty: 9,
    outQty: 2,
    reorderLevel: 4,
    costPrice: 260,
    sellingPrice: 420,
    location: "Treatment cabinet",
    description: "Remineralization cartridge for finished drinking water.",
  },
  {
    sku: "SAN-FOOD-1L",
    name: "Food-Grade Sanitizer 1L",
    category: "Cleaning & Sanitation",
    supplier: "Mindoro Hygiene Depot",
    unit: "bottle",
    openingQty: 14,
    outQty: 3,
    reorderLevel: 5,
    costPrice: 210,
    sellingPrice: 320,
    location: "Chemical shelf",
    description: "No-rinse food contact sanitizer for bottles and equipment.",
  },
  {
    sku: "BRUSH-BTL",
    name: "Bottle Brush",
    category: "Cleaning & Sanitation",
    supplier: "Mindoro Hygiene Depot",
    unit: "piece",
    openingQty: 18,
    outQty: 3,
    reorderLevel: 6,
    costPrice: 75,
    sellingPrice: 130,
    location: "Cleaning station",
    description: "Long-handled brush for 5-gallon bottle washing.",
  },
  {
    sku: "TEST-CL",
    name: "Chlorine Test Kit",
    category: "Testing & Office",
    supplier: "Mindoro Hygiene Depot",
    unit: "kit",
    openingQty: 0,
    outQty: 0,
    reorderLevel: 2,
    costPrice: 380,
    sellingPrice: 560,
    location: "Quality desk",
    description: "Colorimetric test kit for residual chlorine checks.",
  },
  {
    sku: "TEST-TDS",
    name: "TDS Meter",
    category: "Testing & Office",
    supplier: "AquaTech Water Solutions",
    unit: "piece",
    openingQty: 4,
    outQty: 1,
    reorderLevel: 2,
    costPrice: 420,
    sellingPrice: 650,
    location: "Quality desk",
    description: "Handheld total dissolved solids meter.",
  },
  {
    sku: "OFF-RCPT",
    name: "Receipt Paper Roll",
    category: "Testing & Office",
    supplier: "Island Office Essentials",
    unit: "roll",
    openingQty: 40,
    outQty: 8,
    reorderLevel: 12,
    costPrice: 28,
    sellingPrice: 45,
    location: "Front desk",
    description: "Thermal receipt paper roll for delivery receipts.",
  },
];

const seed = async () => {
  await sequelize.authenticate();
  await sequelize.sync();

  const transaction = await sequelize.transaction();

  try {
    const passwordHashAdmin = await bcrypt.hash("Admin@12345", 12);
    const passwordHashStaff = await bcrypt.hash("Staff@12345", 12);

    const [admin] = await User.findOrCreate({
      where: { email: "admin@aquapiol.local" },
      defaults: {
        name: "Piol Admin",
        email: "admin@aquapiol.local",
        password: passwordHashAdmin,
        role: "admin",
      },
      transaction,
    });

    const [staff] = await User.findOrCreate({
      where: { email: "staff@aquapiol.local" },
      defaults: {
        name: "Station Staff",
        email: "staff@aquapiol.local",
        password: passwordHashStaff,
        role: "staff",
      },
      transaction,
    });

    // One actor account per integrated system. stock_movements.userId is NOT NULL.
    for (const [service, email] of [
      ["pos", "pos-system@integration.local"],
      ["customers", "customers-system@integration.local"],
      ["hr", "hr-system@integration.local"],
      ["accounting", "accounting-system@integration.local"],
    ]) {
      await User.findOrCreate({
        where: { email },
        defaults: {
          name: `${service} integration`,
          email,
          password: await bcrypt.hash(crypto.randomUUID(), 8),
          role: "staff",
        },
        transaction,
      });
    }

    for (const [oldName, newName] of Object.entries(legacyCategoryNames)) {
      const legacy = await Category.findOne({ where: { name: oldName }, transaction });
      if (!legacy) continue;
      const existing = await Category.findOne({ where: { name: newName }, transaction });
      if (!existing) await legacy.update({ name: newName }, { transaction });
    }

    const categoryMap = new Map();
    for (const [name, description] of categories) {
      const [category] = await Category.findOrCreate({
        where: { name },
        defaults: { name, description },
        transaction,
      });
      categoryMap.set(name, category);
    }

    const supplierMap = new Map();
    for (const supplier of suppliers) {
      const [row] = await Supplier.findOrCreate({
        where: { name: supplier.name },
        defaults: supplier,
        transaction,
      });
      supplierMap.set(supplier.name, row);
    }

    let newProducts = 0;
    for (const item of products) {
      const category = categoryMap.get(item.category);
      const supplier = supplierMap.get(item.supplier);

      if (!category || !supplier) continue;

      const [product, created] = await Product.findOrCreate({
        where: { sku: item.sku },
        defaults: {
          sku: item.sku,
          name: item.name,
          categoryId: category.id,
          supplierId: supplier.id,
          unit: item.unit,
          quantity: item.openingQty,
          reorderLevel: item.reorderLevel,
          costPrice: item.costPrice,
          sellingPrice: item.sellingPrice,
          location: item.location,
          description: item.description,
        },
        transaction,
      });

      if (!created) continue;
      newProducts += 1;

      if (item.openingQty > 0) {
        await StockMovement.create(
          {
            productId: product.id,
            userId: admin.id,
            supplierId: supplier.id,
            type: "in",
            quantity: item.openingQty,
            previousStock: 0,
            newStock: item.openingQty,
            unitCost: item.costPrice,
            reference: `OPENING-${item.sku}`,
            notes: "Opening balance loaded with the AquaPiol demo data set.",
            createdAt: daysAgo(30, 8),
          },
          { transaction }
        );
      }

      if (item.outQty > 0) {
        const newStock = item.openingQty - item.outQty;
        await product.update({ quantity: newStock }, { transaction });
        await StockMovement.create(
          {
            productId: product.id,
            userId: staff.id,
            supplierId: null,
            type: "out",
            quantity: -item.outQty,
            previousStock: item.openingQty,
            newStock,
            unitCost: null,
            reference: "DAILY-USE",
            notes: "Demo consumption recorded during station operations.",
            createdAt: daysAgo(4, 14),
          },
          { transaction }
        );
      }
    }

    await transaction.commit();

    console.log("✅ Demo data ready");
    console.log(`   Users:    admin@aquapiol.local / Admin@12345`);
    console.log(`             staff@aquapiol.local / Staff@12345`);
    console.log(`   Products: ${newProducts} newly seeded (existing SKUs skipped)`);
    console.log("   Open:     http://localhost:3000");
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
};

seed()
  .catch((error) => {
    console.error("❌ Seeding failed:", error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await sequelize.close();
  });
