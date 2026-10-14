// Seeds the service category tree (hotels, venues, repairs, salons, ...), each with the questions a provider
// answers when listing a service in it, and which categories are normally booked (and by night, day or hour).
// Safe to run repeatedly: existing nodes are matched by name and only get missing details filled in; nothing
// an admin edited is overwritten.
//
//   node scripts/seed-service-categories.js              seed the tree
//   node scripts/seed-service-categories.js --assign     also file un-categorised service listings by keyword
import dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";

dotenv.config();
const prisma = new PrismaClient();
const log = (m) => process.stdout.write(`${m}\n`);

const f = (key, label, type = "text", extra = {}) => ({ key, label, type, required: false, options: [], unit: null, ...extra });
const select = (key, label, options, extra) => f(key, label, "select", { options, ...extra });
const multi = (key, label, options, extra) => f(key, label, "multi_select", { options, ...extra });
const yes = (key, label) => f(key, label, "boolean");

const STAY_AMENITIES = ["Free Wi-Fi", "Breakfast included", "Parking", "Air conditioning", "Swimming pool", "Restaurant", "Gym", "TV", "Hot shower", "Backup power", "Airport pickup", "24-hour security", "Laundry"];
const VENUE_AMENITIES = ["Parking", "Stage", "Sound system", "Projector", "Air conditioning", "Bridal room", "Backup power", "Security", "Tables & chairs included", "Kitchen", "Garden", "Accessible entrance"];

const TREE = [
  {
    name: "Stays & Accommodation",
    bookable: true,
    unit: "night",
    fields: [
      select("roomType", "Room type", ["Single", "Double", "Twin", "Suite", "Family room", "Dormitory bed", "Whole apartment/house"], { required: true }),
      select("meals", "Meals", ["Room only", "Bed & breakfast", "Half board", "Full board"]),
      multi("amenities", "Amenities", STAY_AMENITIES),
      f("beds", "Number of beds", "number")
    ],
    children: [{ name: "Hotels", fields: [select("stars", "Star rating", ["Unrated", "1", "2", "3", "4", "5"])] }, { name: "Guest houses & lodges" }, { name: "Apartments & short stays" }, { name: "Hostels" }, { name: "Resorts & safari lodges", fields: [yes("gamePackages", "Offers game or activity packages")] }]
  },
  {
    name: "Venues & Events",
    bookable: true,
    unit: "day",
    fields: [
      f("capacity", "Capacity", "number", { required: true, unit: "guests" }),
      select("setting", "Setting", ["Indoor", "Outdoor", "Indoor and outdoor"]),
      multi("amenities", "What's included", VENUE_AMENITIES),
      select("catering", "Catering", ["In-house catering", "Outside caterers allowed", "Bring your own"])
    ],
    children: [{ name: "Wedding & reception venues" }, { name: "Conference & meeting rooms", unit: "hour" }, { name: "Gardens & outdoor spaces" }, { name: "Event equipment hire", fields: [multi("items", "Items for hire", ["Tents", "Chairs & tables", "Sound system", "Lighting", "Decor", "Generators"])] }, { name: "Event planners" }]
  },
  {
    name: "Food & Catering",
    fields: [multi("serviceTypes", "How customers get it", ["Dine-in", "Takeaway", "Delivery", "Catering for events"], { required: true }), multi("cuisine", "Cuisine", ["Ugandan", "Continental", "Indian", "Chinese", "Fast food", "Vegetarian", "Seafood", "Bakery"]), select("priceRange", "Price range", ["Budget", "Mid-range", "Premium"])],
    children: [{ name: "Restaurants & cafés" }, { name: "Catering services" }, { name: "Bakers & cakes" }, { name: "Food delivery" }]
  },
  {
    name: "Beauty & Wellness",
    fields: [multi("treatments", "Treatments offered", ["Haircut & styling", "Braiding", "Colouring", "Manicure & pedicure", "Makeup", "Massage", "Facial", "Waxing"]), select("clients", "Who it's for", ["Women", "Men", "Everyone"]), yes("homeService", "Comes to the customer's home")],
    children: [{ name: "Hair salons", bookable: true, unit: "hour" }, { name: "Barbers", bookable: true, unit: "hour" }, { name: "Nails & makeup", bookable: true, unit: "hour" }, { name: "Spa & massage", bookable: true, unit: "hour" }, { name: "Gyms & fitness" }]
  },
  {
    name: "Repairs & Maintenance",
    fields: [yes("homeVisit", "Home or on-site visits"), select("turnaround", "Usual turnaround", ["Same day", "1-2 days", "3-7 days", "More than a week"]), select("warranty", "Warranty on work", ["None", "30 days", "3 months", "6 months", "12 months"]), yes("emergency", "Emergency / 24-hour call-outs")],
    children: [{ name: "Phone repair", fields: [f("brands", "Brands handled")] }, { name: "Computer & laptop repair", fields: [f("brands", "Brands handled")] }, { name: "TV & appliance repair" }, { name: "Car mechanics & garages" }, { name: "Plumbing" }, { name: "Electrical work" }, { name: "Carpentry & furniture" }, { name: "Painting & finishing" }]
  },
  {
    name: "Transport & Car Hire",
    fields: [select("vehicleType", "Vehicle type", ["Saloon car", "SUV / 4x4", "Van / minibus", "Truck", "Motorcycle", "Bus / coaster"], { required: true }), f("seats", "Seats", "number"), yes("withDriver", "Driver included"), select("fuel", "Fuel", ["Customer pays fuel", "Fuel included"])],
    children: [{ name: "Car hire", bookable: true, unit: "day" }, { name: "Airport transfers & taxis" }, { name: "Moving & trucks" }, { name: "Tours & safaris", bookable: true, unit: "day" }, { name: "Delivery riders" }]
  },
  {
    name: "Health & Medical",
    fields: [f("specialities", "Specialities / services", "textarea"), yes("open24", "Open 24 hours"), yes("emergency", "Emergency services"), multi("insurance", "Insurance accepted", ["AAR", "Jubilee", "UAP / Old Mutual", "Sanlam", "Prudential", "NHIF / other"])],
    children: [{ name: "Clinics & hospitals" }, { name: "Dentists" }, { name: "Pharmacies" }, { name: "Medical labs" }, { name: "Physiotherapy & therapy" }]
  },
  {
    name: "Education & Training",
    fields: [select("mode", "Delivered", ["In person", "Online", "Both"], { required: true }), f("duration", "Course length"), yes("certificate", "Certificate awarded"), select("level", "Level", ["Beginner", "Intermediate", "Advanced", "All levels"])],
    children: [{ name: "Tutors & private lessons" }, { name: "Driving schools" }, { name: "Computer & ICT training" }, { name: "Language classes" }, { name: "Music & arts lessons" }]
  },
  {
    name: "Professional & Business",
    fields: [f("experience", "Years of experience", "number"), yes("registered", "Registered business"), select("pricing", "Pricing", ["Fixed price", "Per hour", "Per project", "Quote on request"])],
    children: [{ name: "Photography & video", bookable: true, unit: "hour" }, { name: "Accounting & tax" }, { name: "Legal services" }, { name: "Printing & design" }, { name: "Cleaning services" }, { name: "Security services" }, { name: "Gardening & landscaping" }, { name: "Real estate agents" }]
  }
];

const upsertNode = async ({ name, parentId, fields, bookable, unit }, sortOrder) => {
  const existing = await prisma.serviceCategory.findFirst({ where: { name, parentId } });
  if (existing) {
    const patch = {};
    if (!existing.bookingUnit && unit) patch.bookingUnit = unit;
    if (Object.keys(patch).length) await prisma.serviceCategory.update({ where: { id: existing.id }, data: patch });
    return existing;
  }
  return prisma.serviceCategory.create({ data: { name, parentId, listingFields: fields ?? [], bookable: Boolean(bookable), bookingUnit: unit ?? null, sortOrder } });
};

const seedTree = async () => {
  let created = 0;
  for (const [i, top] of TREE.entries()) {
    const before = await prisma.serviceCategory.count();
    const parent = await upsertNode({ name: top.name, parentId: null, fields: top.fields, bookable: top.bookable, unit: top.unit }, i);
    for (const [j, child] of (top.children ?? []).entries()) {
      await upsertNode({ name: child.name, parentId: parent.id, fields: child.fields, bookable: child.bookable ?? top.bookable, unit: child.unit ?? top.unit }, j);
    }
    created += (await prisma.serviceCategory.count()) - before;
  }
  log(`Service categories: ${created} created.`);
};

// Files service listings that have no service category yet into the closest leaf, by keywords in the name.
const KEYWORDS = [
  [/hotel|motel/i, "Hotels"], [/lodge|guest ?house|inn\b/i, "Guest houses & lodges"], [/apartment|airbnb|studio flat/i, "Apartments & short stays"], [/hostel/i, "Hostels"], [/resort|safari lodge/i, "Resorts & safari lodges"],
  [/wedding|reception|venue|banquet/i, "Wedding & reception venues"], [/conference|meeting room|boardroom/i, "Conference & meeting rooms"], [/garden/i, "Gardens & outdoor spaces"], [/tent|chairs|decor|hire/i, "Event equipment hire"], [/event plann/i, "Event planners"],
  [/restaurant|cafe|café|grill|kitchen|eatery/i, "Restaurants & cafés"], [/cater/i, "Catering services"], [/cake|bakery|baker/i, "Bakers & cakes"],
  [/salon|hair|braid/i, "Hair salons"], [/barber/i, "Barbers"], [/nail|makeup|make-up/i, "Nails & makeup"], [/spa|massage/i, "Spa & massage"], [/gym|fitness/i, "Gyms & fitness"],
  [/phone|screen|iphone|samsung|infinix/i, "Phone repair"], [/laptop|computer|pc\b/i, "Computer & laptop repair"], [/tv|fridge|appliance|microwave|washing/i, "TV & appliance repair"], [/car |mechanic|garage|engine|brake/i, "Car mechanics & garages"], [/plumb|pipe|tap\b|drain/i, "Plumbing"], [/electric|wiring|socket/i, "Electrical work"], [/carpent|furniture|wood/i, "Carpentry & furniture"], [/paint/i, "Painting & finishing"],
  [/car hire|rental|rent a car/i, "Car hire"], [/airport|taxi|transfer/i, "Airport transfers & taxis"], [/moving|truck|haulage/i, "Moving & trucks"], [/safari|tour|gorilla/i, "Tours & safaris"], [/delivery/i, "Delivery riders"],
  [/clinic|hospital|doctor|medical/i, "Clinics & hospitals"], [/dent/i, "Dentists"], [/pharm/i, "Pharmacies"], [/lab\b|laborator/i, "Medical labs"], [/physio|therap/i, "Physiotherapy & therapy"],
  [/tutor|lesson|teacher/i, "Tutors & private lessons"], [/driving/i, "Driving schools"], [/computer training|ict|coding/i, "Computer & ICT training"], [/language|english|french/i, "Language classes"], [/music|piano|guitar|dance/i, "Music & arts lessons"],
  [/photo|video|camera/i, "Photography & video"], [/account|tax|audit/i, "Accounting & tax"], [/legal|lawyer|advocate/i, "Legal services"], [/print|design|logo/i, "Printing & design"], [/clean|laundry|fumig/i, "Cleaning services"], [/security|guard/i, "Security services"], [/garden|landscap|lawn/i, "Gardening & landscaping"], [/real estate|property|agent/i, "Real estate agents"]
];

const assignListings = async () => {
  const leaves = await prisma.serviceCategory.findMany({ where: { parentId: { not: null } } });
  const byName = new Map(leaves.map((l) => [l.name, l.id]));
  const listings = await prisma.serviceProduct.findMany({ where: { type: "service", serviceCategoryId: null }, select: { id: true, name: true } });
  let assigned = 0;
  for (const listing of listings) {
    const hit = KEYWORDS.find(([re, leaf]) => re.test(listing.name) && byName.has(leaf));
    if (!hit) continue;
    await prisma.serviceProduct.update({ where: { id: listing.id }, data: { serviceCategoryId: byName.get(hit[1]) } });
    assigned += 1;
  }
  log(`Service listings filed into a category: ${assigned} of ${listings.length}.`);
};

try {
  await seedTree();
  if (process.argv.includes("--assign")) await assignListings();
} finally {
  await prisma.$disconnect();
}
