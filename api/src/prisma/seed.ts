// prisma/seed.ts
import { PrismaClient, RiskBand } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Seeds Unilever Risk Matrix 1 exactly as provided.
 *
 * Severity scores: 1,2,4,6,8,10
 * Likelihood (Probability) scores: 10,8,6,4,2,1
 *
 * Bands: VERY_LOW, LOW, MEDIUM, MEDIUM_PLUS, HIGH, VERY_HIGH
 */
async function seedRiskMatrixUnilever1() {
  const matrixName = 'Unilever Risk Matrix 1';

  const severities = [1, 2, 4, 6, 8, 10];
  const probabilities = [10, 8, 6, 4, 2, 1];

  // Exact table mapping (row = likelihood/probability, col = severity)
  const bandTable: Record<number, Record<number, RiskBand>> = {
    10: {
      1: RiskBand.LOW,
      2: RiskBand.HIGH,
      4: RiskBand.VERY_HIGH,
      6: RiskBand.VERY_HIGH,
      8: RiskBand.VERY_HIGH,
      10: RiskBand.VERY_HIGH,
    },
    8: {
      1: RiskBand.LOW,
      2: RiskBand.MEDIUM_PLUS,
      4: RiskBand.HIGH,
      6: RiskBand.VERY_HIGH,
      8: RiskBand.VERY_HIGH,
      10: RiskBand.VERY_HIGH,
    },
    6: {
      1: RiskBand.LOW,
      2: RiskBand.MEDIUM,
      4: RiskBand.MEDIUM_PLUS,
      6: RiskBand.HIGH,
      8: RiskBand.VERY_HIGH,
      10: RiskBand.VERY_HIGH,
    },
    4: {
      1: RiskBand.VERY_LOW,
      2: RiskBand.LOW,
      4: RiskBand.MEDIUM,
      6: RiskBand.MEDIUM_PLUS,
      8: RiskBand.HIGH,
      10: RiskBand.VERY_HIGH,
    },
    2: {
      1: RiskBand.VERY_LOW,
      2: RiskBand.VERY_LOW,
      4: RiskBand.LOW,
      6: RiskBand.MEDIUM,
      8: RiskBand.HIGH,
      10: RiskBand.HIGH,
    },
    1: {
      1: RiskBand.VERY_LOW,
      2: RiskBand.VERY_LOW,
      4: RiskBand.LOW,
      6: RiskBand.LOW,
      8: RiskBand.MEDIUM_PLUS,
      10: RiskBand.HIGH,
    },
  };

  const existing = await prisma.riskMatrix.findFirst({
    where: { name: matrixName },
    select: { id: true },
  });

  const matrix = existing
    ? await prisma.riskMatrix.update({
        where: { id: existing.id },
        data: { isActive: true },
      })
    : await prisma.riskMatrix.create({
        data: { name: matrixName, isActive: true },
      });

  // Rebuild cells deterministically for this matrix
  await prisma.$transaction(async (tx) => {
    await tx.riskMatrixCell.deleteMany({ where: { matrixId: matrix.id } });

    for (const p of probabilities) {
      for (const s of severities) {
        const band = bandTable[p][s];
        const rating = p * s; // numeric score for sorting; band is the real output

        await tx.riskMatrixCell.create({
          data: {
            matrixId: matrix.id,
            severity: s,
            probability: p,
            rating,
            band,
          },
        });
      }
    }
  });

  console.log(`✅ Seeded risk matrix: ${matrixName}`);
}

/**
 * Seeds the hazard library (categories + hazards).
 * Idempotent and safe:
 * - Categories are upserted by name
 * - Hazards are upserted by code (schema has code @unique)
 *
 * IMPORTANT FIX:
 * Your original seed used hazardSort++ inside BOTH create/update of upsert.
 * JS evaluates both objects before Prisma picks a branch → sortOrder increments twice.
 * This version assigns sortOrder deterministically using the loop index.
 */
async function seedHazardLibrary() {
  type SeedCategory = {
    name: string;
    sortOrder: number;
    hazards: { code: string; name: string; description?: string }[];
  };

  const library: SeedCategory[] = [
    {
      name: 'Gravity',
      sortOrder: 10,
      hazards: [
        {
          code: '1.2',
          name: 'Elevated work areas (ladders, scaffolds roofs, platforms)',
        },
        { code: '1.3', name: 'Stairs' },
        { code: '1.4', name: 'Holes/openings/ penetrations in floors' },
        { code: '1.5', name: 'Falling materials or objects' },
        { code: '1.6', name: 'Trip/Slip hazards' },
      ],
    },
    {
      name: 'Work Environment',
      sortOrder: 20,
      hazards: [
        { code: '1.8', name: 'Noise' },
        { code: '1.9', name: 'Oxygen deficiency' },
        { code: '1.10', name: 'Hot/cold, humidity' },
        { code: '1.11', name: 'Water/Floods' },
        { code: '1.12', name: 'Deep Liquids' },
      ],
    },
    {
      name: 'Temperature',
      sortOrder: 30,
      hazards: [
        { code: '1.14', name: 'Hot surfaces or flames' },
        { code: '1.15', name: 'Hot liquids or steam' },
        { code: '1.16', name: 'Elevated/ Low temperatures' },
      ],
    },
    {
      name: 'People',
      sortOrder: 40,
      hazards: [
        { code: '1.18', name: 'Violent or abusive people' },
        { code: '1.19', name: 'Impaired performance from drugs or alcohol' },
        { code: '1.20', name: 'Workplace smoking' },
      ],
    },
    {
      name: 'Other Workplace Hazards',
      sortOrder: 50,
      hazards: [
        { code: '1.22', name: 'Pressurised plant: air, gas or hydraulics' },
        {
          code: '1.23',
          name: 'Severe weather, Earthquake, wind, rain, snow, etc',
        },
        { code: '1.24', name: 'Adjacent facilities' },
        { code: '1.25', name: 'Confined spaces' },
      ],
    },
    {
      name: 'Fire/Explosion/Reaction',
      sortOrder: 60,
      hazards: [
        { code: '1.27', name: 'Chemical Reaction' },
        { code: '1.28', name: 'Combustible dust' },
        { code: '1.29', name: 'Flammable liquid/gas/vapour' },
        { code: '1.30', name: 'Hot work, flame or spark' },
        { code: '1.31', name: 'Reactive chemical' },
      ],
    },
    {
      name: 'Machinery/Equipment',
      sortOrder: 70,
      hazards: [
        { code: '1.33', name: 'Moving Parts' },
        { code: '1.34', name: 'Sharp edges/points' },
        { code: '1.35', name: 'Breakages and releases (sparks, chips, fume)' },
        { code: '1.36', name: 'Stored energy' },
        { code: '1.37', name: 'Failure or collapse of equipment, racking' },
        { code: '1.38', name: 'Vibration' },
      ],
    },
    {
      name: 'Ergonomics',
      sortOrder: 80,
      hazards: [
        { code: '1.40', name: 'Manual Handling' },
        { code: '1.41', name: 'Repetitive Movement' },
        { code: '1.42', name: 'Static or awkward posture' },
        { code: '1.43', name: 'Lighting levels, glare and contrast' },
      ],
    },
    {
      name: 'Electricity',
      sortOrder: 90,
      hazards: [
        { code: '1.45', name: 'Exposed Conductors' },
        { code: '1.46', name: 'Overloaded circuits' },
        { code: '1.47', name: 'High voltages' },
        { code: '1.48', name: 'Static electricity' },
      ],
    },
    {
      name: 'Transport',
      sortOrder: 100,
      hazards: [
        { code: '1.50', name: 'Lift trucks, pallet trucks' },
        { code: '1.51', name: 'Delivery vehicles' },
        { code: '1.52', name: 'On-site vehicles' },
        {
          code: '1.53',
          name: 'Traffic movements (large delivery vehicles, frequent deliveries, staff vehicles)',
        },
      ],
    },
    {
      name: 'Other Work Activity Hazards',
      sortOrder: 110,
      hazards: [
        { code: '1.55', name: 'Psychological stressors' },
        { code: '1.56', name: 'Animals: bites, kicks, stings' },
        { code: '1.57', name: 'Fatigue' },
      ],
    },
    {
      name: 'Chemical/Sensitising Agents',
      sortOrder: 120,
      hazards: [
        { code: '1.60', name: 'Hazardous Substances' },
        { code: '1.61', name: 'Gases, vapours, fumes' },
        { code: '1.62', name: 'Incompatible chemicals' },
        { code: '1.63', name: 'Latex gloves' },
        { code: '1.64', name: 'Enzymes' },
        { code: '1.65', name: 'No SDS' },
      ],
    },
    {
      name: 'Radiation',
      sortOrder: 130,
      hazards: [
        { code: '1.67', name: 'Ionising radiation' },
        { code: '1.68', name: 'Ultraviolet or infra-red radiations' },
        { code: '1.69', name: 'Lasers' },
      ],
    },
    {
      name: 'Work Procedures',
      sortOrder: 140,
      hazards: [
        { code: '1.71', name: 'Inadequate Work Procedures' },
        { code: '1.72', name: 'Lack of Training' },
      ],
    },
    {
      name: 'Biological and Other Hazardous Agents',
      sortOrder: 150,
      hazards: [
        { code: '1.74', name: 'Pathogens' },
        { code: '1.75', name: 'Legionella' },
        { code: '1.76', name: 'Building Materials (asbestos, PCBs, lead)' },
      ],
    },
    {
      name: 'Environment',
      sortOrder: 160,
      hazards: [
        {
          code: '1.78',
          name: 'Solid/ Liquid Waste generated (new type or change in volume)',
        },
        {
          code: '1.79',
          name: 'Waste requiring separate collection and offsite disposal inc recycling',
        },
        {
          code: '1.80',
          name: 'Spillages of fuels, oils, bulk liquids or liquid wastes during transportation/handling/storage',
        },
        {
          code: '1.81',
          name: 'Leakages of materials as above from bunds, tanks, drums, sewers or production pipework',
        },
      ],
    },
  ];

  for (const cat of library) {
    const existingCat = await prisma.hazardCategory.findFirst({
      where: { name: cat.name },
      select: { id: true },
    });

    const category = existingCat
      ? await prisma.hazardCategory.update({
          where: { id: existingCat.id },
          data: { sortOrder: cat.sortOrder },
        })
      : await prisma.hazardCategory.create({
          data: { name: cat.name, sortOrder: cat.sortOrder },
        });

    for (let i = 0; i < cat.hazards.length; i++) {
      const hz = cat.hazards[i];
      const sortOrder = i + 1;

      await prisma.hazard.upsert({
        where: { code: hz.code },
        create: {
          categoryId: category.id,
          code: hz.code,
          name: hz.name,
          description: hz.description,
          active: true,
          sortOrder,
        },
        update: {
          categoryId: category.id,
          name: hz.name,
          description: hz.description,
          active: true,
          sortOrder,
        },
      });
    }
  }

  console.log('✅ Seeded hazard library');
}

/**
 * Seeds task meta:
 * - TaskCategory: Normal/Abnormal/Emergency/Cleaning/Maintenance
 * - TaskPhase: Startup/Running/Shutdown/N/A
 */
async function seedTaskMeta() {
  const categories = [
    'Normal Operations',
    'Abnormal Operations',
    'Emergency Operations',
    'Cleaning',
    'Maintenance',
  ];

  const phases = ['Startup', 'Running', 'Shutdown', 'N/A'];

  for (let i = 0; i < categories.length; i++) {
    await prisma.taskCategory.upsert({
      where: { name: categories[i] },
      create: { name: categories[i], sortOrder: i, isActive: true },
      update: { sortOrder: i, isActive: true },
    });
  }

  for (let i = 0; i < phases.length; i++) {
    await prisma.taskPhase.upsert({
      where: { name: phases[i] },
      create: { name: phases[i], sortOrder: i, isActive: true },
      update: { sortOrder: i, isActive: true },
    });
  }

  console.log('✅ Seeded task meta');
}

/**
 * Seeds action/recommendation categories used to group ADDITIONAL controls.
 * (Edit these to match the categories you want in the Risk Management dashboard.)
 */
async function seedActionCategories() {
  const cats = [
    { name: 'Guarding / Interlocks', color: '#EF4444' },
    { name: 'LOTO / Isolation', color: '#F59E0B' },
    { name: 'Training / SOP', color: '#3B82F6' },
    { name: 'Housekeeping / 5S', color: '#10B981' },
    { name: 'PPE / Signage', color: '#8B5CF6' },
  ];

  for (let i = 0; i < cats.length; i++) {
    await prisma.actionCategory.upsert({
      where: { name: cats[i].name },
      create: {
        name: cats[i].name,
        color: cats[i].color,
        sortOrder: i,
        isActive: true,
      },
      update: {
        color: cats[i].color,
        sortOrder: i,
        isActive: true,
      },
    });
  }

  console.log('✅ Seeded action categories');
}

async function main() {
  await seedRiskMatrixUnilever1();
  await seedHazardLibrary();
  await seedTaskMeta();
  await seedActionCategories();
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
