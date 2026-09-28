// Seeds the ProductCategory tree from Jiji.ug's own category tree + per-category attribute schema
// (see jiji-categories.md / jiji-category-fields.md at the repo root - not committed, source docs
// only). Idempotent: upserts on the existing @@unique([parentId, name]) constraint, so it's safe to
// re-run after correcting a field or adding options. Images are intentionally left null throughout
// ("batch without pics" - an admin adds photos later via the Shop Categories screen).
//
// Scope decisions applied throughout (confirmed with the user):
//  - The standalone "Services" tree, and every "...Services" leaf embedded in other trees (Car
//    Services, Pet Services, Manufacturing Services, Business Services, Health & Beauty Services,
//    Building & Trades/Repair Services, Fitness & Personal Training Services, Child Care &
//    Education Services), are all dropped - deferred to a future dedicated Services module.
//  - "Jobs" and "Seeking Work - CVs" are dropped entirely - not product categories.
//  - Where Jiji lists the same subcategory under two parents, it's created ONCE under whichever
//    parent the source doc gives the actual field table for (the other listing was always
//    "same as SS"): Personal Mobility -> Vehicles, Massagers -> Beauty & Personal Care,
//    Headphones -> Phones & Tablets, Commercial Property For Rent -> Property, Children's
//    Clothing/Shoes/Babies & Kids Accessories -> Fashion's Baby & Kids' Fashion group,
//    Commercial Equipment & Tools kept only as its own top-level tree.
//
// Field-authoring rule: the inheritance merge (ProductCategoryService#getNestedCategories) is
// additive/override only - a child can't REMOVE a field its parent declares. So shared fields are
// only hoisted onto a parent node where the source doc confirms EVERY child genuinely shares them
// with no exceptions (e.g. the 9 Electrical Equipment sub-types: Brand + Condition common, only
// Type differs). Everywhere the doc calls out an exception, each leaf's field list is written out
// in full instead, to avoid inheriting a field onto a category that shouldn't have it.
//
// Known limitation: Jiji's own doc truncates big enums ("Toyota, Subaru, Mercedes-Benz, Nissan,
// Mitsubishi, Mazda...") - `options` below are exactly the example values given, a starter list,
// not Jiji's full internal enum. Where the source doc says a field is required/present but gives
// no example values at all (common in the Beauty & Personal Care and Commercial Equipment
// sections), `options` is left empty rather than inventing plausible-sounding values that were
// never actually in the source - the admin fills those in via the Fields editor.
import dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";

dotenv.config();
const prisma = new PrismaClient();

// Compact field-definition builder matching ProductCategory.listingFields' shape exactly
// ({key,label,type,required,options,unit} - see src/constants/dynamicFieldSchema.js).
const f = (key, label, type, opts = {}) => ({
  key,
  label,
  type,
  required: Boolean(opts.required),
  options: opts.options || [],
  unit: opts.unit ?? null
});

const CONDITION_STD = ["Brand New", "Refurbished", "Used"];
const CONDITION_SIMPLE = ["Brand New", "Used"];

const TREE = [
  // ---------------------------------------------------------------- 1. Vehicles
  {
    name: "Vehicles",
    children: [
      {
        name: "Cars",
        fields: [
          f("make", "Make", "select", { required: true, options: ["Toyota", "Subaru", "Mercedes-Benz", "Nissan", "Mitsubishi", "Mazda"] }),
          f("yearOfManufacture", "Year of Manufacture", "number", { required: true }),
          f("condition", "Condition", "multi_select", { required: true, options: ["Brand New", "Foreign Used", "Local Used"] }),
          f("drivetrain", "Drivetrain", "multi_select", { options: ["Rear Wheel", "Front Wheel", "4WD", "AWD", "4x4", "4x2"] }),
          f("transmission", "Transmission", "multi_select", { options: ["AMT", "Automatic", "CVT", "Manual"] }),
          f("mileage", "Mileage", "number", { unit: "km" }),
          f("registeredCar", "Registered Car", "boolean"),
          f("body", "Body", "multi_select", { options: ["Wagon", "SUV", "Sedan", "Pickup", "Minivan"] }),
          f("secondCondition", "Second Condition", "multi_select", { options: ["After crash", "Engine issue", "First owner", "Need body repair"] }),
          f("color", "Color", "multi_select", { options: ["Beige", "Black", "Blue", "Brown", "Burgundy", "Gold"] }),
          f("engineSize", "Engine Size", "number", { unit: "cc" }),
          f("powertrainType", "Powertrain Type", "multi_select", { options: ["Electric", "Hybrid", "Internal Combustion"] }),
          f("fuel", "Fuel", "multi_select", { options: ["Petrol", "Diesel"] }),
          f("keyFeatures", "Key Features", "multi_select", { options: ["360 Camera", "Air Conditioning", "Airbags", "Alloy Wheels"] }),
          f("highlights", "Popular Filters (Highlights)", "multi_select", { options: ["Low Mileage", "4WD/AWD", "Automatic Cars", "SUVs"] })
        ]
      },
      {
        name: "Vehicle Parts & Accessories",
        fields: [
          f("make", "Make (compatible vehicle)", "select", { required: true, options: ["Acura", "Alfa Romeo", "Audi", "Bajaj"] }),
          f("type", "Type", "select", { required: true, options: ["Apparel & Protective Gear", "Audio Parts", "Brakes/Suspension/Steering", "Car Care"] }),
          f("condition", "Condition", "multi_select", { options: CONDITION_STD }),
          f("bulkPriceAvailable", "Bulk Price available", "boolean")
        ]
      },
      {
        name: "Motorcycles & Scooters",
        fields: [
          f("make", "Make", "select", { required: true, options: ["American Ironhorse", "Aprilia", "Apsonic", "Arctic Cat"] }),
          f("condition", "Condition", "multi_select", { required: true, options: ["Brand New", "Foreign Used", "Local Used"] }),
          f("yearOfManufacture", "Year of Manufacture", "number"),
          f("powertrain", "Powertrain", "select", { options: ["Electric", "Internal Combustion"] }),
          f("type", "Type", "multi_select", { options: ["Cruiser", "Dual Sport", "Motocross", "Quad (ATV)", "Retro", "Scooter"] }),
          f("color", "Color", "multi_select", { options: ["Beige", "Black", "Blue", "Brown", "Gold", "Gray"] }),
          f("exchangePossible", "Exchange Possible", "boolean")
        ]
      },
      {
        name: "Buses & Microbuses",
        fields: [
          f("make", "Make", "select", { required: true, options: ["Daihatsu", "Fiat", "Ford", "Honda", "Isuzu", "Mazda"] }),
          f("yearOfManufacture", "Year of Manufacture", "number", { required: true }),
          f("condition", "Condition", "multi_select", { required: true, options: ["Brand New", "Foreign Used", "Local Used"] }),
          f("transmission", "Transmission", "multi_select", { options: ["Automatic", "Manual"] }),
          f("color", "Color", "multi_select", { options: ["Beige", "Black", "Blue", "Brown", "Gold", "Green"] }),
          f("secondCondition", "Second Condition", "multi_select", { options: ["First owner", "First registration", "Need body repair"] }),
          f("fuel", "Fuel", "multi_select", { options: ["Diesel", "Petrol"] }),
          f("exchangePossible", "Exchange Possible", "boolean")
        ]
      },
      {
        name: "Trucks & Trailers",
        fields: [
          f("type", "Type", "select", { required: true, options: ["Box Trucks", "Crane Trucks", "Dump Trucks", "Fire Fighting Trucks", "Food Trucks"] }),
          f("make", "Make", "select", { required: true, options: ["Akij", "Chevrolet", "CNHTC Howo", "DAF", "Daihatsu"] }),
          f("yearOfManufacture", "Year of Manufacture", "number", { required: true }),
          f("condition", "Condition", "multi_select", { options: CONDITION_SIMPLE }),
          f("exchangePossible", "Exchange Possible", "boolean")
        ]
      },
      {
        name: "Construction & Heavy Machinery",
        fields: [
          f("condition", "Condition", "multi_select", { required: true, options: ["Brand New", "Foreign Used", "Ugandan Used"] }),
          f("type", "Type", "select", { required: true, options: ["Aerial Platforms", "Asphalt Pavers", "Backhoe Loaders", "Bulldozers"] }),
          f("make", "Make", "multi_select", { required: true, options: ["Aichi", "Atlas Copco", "Bitelli", "Bobcat", "Bomag", "Case"] }),
          f("yearOfManufacture", "Year of Manufacture", "number"),
          f("exchangePossible", "Exchange Possible", "boolean")
        ]
      },
      {
        name: "Watercraft & Boats",
        fields: [
          f("type", "Type", "select", { required: true, options: ["Yachts", "Centre Console Boats", "Lifeboats", "Bow Rider Boats", "Deck Boats"] }),
          f("condition", "Condition", "multi_select", { required: true, options: CONDITION_SIMPLE }),
          f("yearOfManufacture", "Year of Manufacture", "number"),
          f("exchangePossible", "Exchange Possible", "boolean")
        ]
      },
      {
        name: "Personal Mobility",
        fields: [
          f("type", "Type", "select", { required: true, options: ["Bicycles", "Electric Bicycles", "Balance Bikes", "Kick Scooters", "Electric Scooters", "Unicycles"] }),
          f("ageGroup", "Age Group", "multi_select", { required: true, options: ["2-3 Years", "3-4 Years", "4-5 Years", "5 Years+", "Teens", "Adults"] }),
          f("condition", "Condition", "select", { required: true, options: CONDITION_SIMPLE }),
          f("color", "Color", "multi_select", { options: ["Black", "Blue", "Brown", "Gold", "Gray", "Green"] })
        ]
      }
    ]
  },

  // ---------------------------------------------------------------- 2. Property
  {
    name: "Property",
    children: [
      {
        name: "New Builds",
        fields: [
          f("propertyType", "Property Type", "select", { required: true, options: ["Apartment", "Condominium", "Townhouse", "Other"] }),
          f("bedrooms", "Number of Bedrooms", "select", { required: true, options: ["1", "2", "3", "4", "5", "6", "7", "8", "9+"] }),
          f("constructionStatus", "Status of Construction", "multi_select", { options: ["Commissioning", "Completed", "Facade Finished", "Foundation", "Frame Finished"] }),
          f("propertySize", "Property Size", "number", { unit: "sqm" }),
          f("housingClass", "Housing Class", "multi_select", { options: ["Business", "Comfort", "Economy", "Premium"] }),
          f("security", "Security", "boolean"),
          f("bathrooms", "Number of Bathrooms", "select", { options: ["1", "2", "3", "4", "5", "6", "7+"] }),
          f("facilities", "Facilities", "multi_select", { options: ["BBQ Zone", "Elevator", "Gym", "Office Space", "Swimming Pool"] })
        ]
      },
      {
        name: "Houses & Apartments For Rent",
        fields: [
          f("propertyType", "Property Type", "multi_select", { required: true, options: ["Apartment", "Bedsitter", "Block of Flats", "Bungalow", "Chalet", "Duplex"] }),
          f("bedrooms", "Bedrooms", "select", { required: true, options: ["1", "2", "3", "4", "5", "6+"] }),
          f("condition", "Condition", "multi_select", { required: true, options: ["Fairly Used", "Newly Built", "Old", "Renovated"] }),
          f("furnishing", "Furnishing", "multi_select", { required: true, options: ["Furnished", "Semi-Furnished", "Unfurnished"] }),
          f("bathrooms", "Bathrooms", "select", { options: ["1", "2", "3", "4", "5", "6+"] }),
          f("facilities", "Facilities", "multi_select", { options: ["24 Hours Electricity", "Air Conditioning", "Backup Generator", "Balcony", "BBQ Area"] }),
          f("propertySize", "Property Size", "number", { unit: "sqm" })
        ]
      },
      {
        name: "Houses & Apartments For Sale",
        fields: [
          f("propertyType", "Property Type", "multi_select", { required: true, options: ["Apartment", "Bedsitter", "Block of Flats", "Bungalow", "Chalet", "Duplex", "Room & Parlour", "Mini Flat", "Studio Apartment"] }),
          f("bedrooms", "Bedrooms", "select", { required: true, options: ["1", "2", "3", "4", "5", "6+"] }),
          f("condition", "Condition", "multi_select", { required: true, options: ["Fairly Used", "Newly Built", "Old", "Renovated", "Off-Plan", "Uncompleted Building"] }),
          f("furnishing", "Furnishing", "multi_select", { required: true, options: ["Furnished", "Semi-Furnished", "Unfurnished"] }),
          f("bathrooms", "Bathrooms", "select", { options: ["1", "2", "3", "4", "5", "6+"] }),
          f("facilities", "Facilities", "multi_select", { options: ["24 Hours Electricity", "Air Conditioning", "Backup Generator", "Balcony", "BBQ Area"] }),
          f("propertySize", "Property Size", "number", { unit: "sqm" })
        ]
      },
      {
        name: "Short Let",
        fields: [
          f("propertyType", "Property Type", "select", { options: ["Apartments", "Bungalow", "Duplex House", "Flat", "House", "Mini Flat"] }),
          f("totalRooms", "Total Rooms", "select", { options: ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10+"] }),
          f("bedrooms", "Bedrooms", "select", { options: ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10+"] }),
          f("bathrooms", "Bathrooms", "select", { options: ["1", "2", "3", "4", "5+"] })
        ]
      },
      {
        name: "Land & Plots for Rent",
        fields: [
          f("type", "Type", "select", { required: true, options: ["Commercial Land", "Farmland", "Industrial Land", "Mixed-use Land", "Residential Land"] }),
          f("squareMetres", "Square Metres", "number", { unit: "sqm" }),
          f("propertyUse", "Property Use", "multi_select", { options: ["Commercial", "Mixed", "Residential"] })
        ]
      },
      {
        name: "Land & Plots For Sale",
        fields: [
          f("type", "Type", "select", { required: true, options: ["Commercial Land", "Farmland", "Industrial Land", "Mixed-use Land", "Residential Land", "Quarry"] }),
          f("squareMetres", "Square Metres", "number", { required: true, unit: "sqm" }),
          f("propertyUse", "Property Use", "multi_select", { options: ["Commercial", "Mixed", "Residential"] }),
          f("facilities", "Facilities", "multi_select", { options: ["Car Parking", "Domestic Sewage", "Electric Supply", "Gas Supply", "Water Supply"] })
        ]
      },
      {
        name: "Event Centres, Venues & Workstations",
        fields: [
          f("type", "Type", "select", { required: true, options: ["Gardens", "Marquee", "Meeting Room", "Workstation", "Other"] }),
          f("duration", "Duration", "multi_select", { options: ["Daily"] }),
          f("facilities", "Facilities", "multi_select", { options: ["Air Conditioner", "Chairs", "Changing Room", "Internet", "Power Generator", "Projector"] })
        ]
      },
      {
        name: "Commercial Property For Rent",
        fields: [
          f("propertyType", "Property Type", "select", { options: ["Apartment", "Complex", "Factory", "Garage", "Hotel", "Maisonette"] }),
          f("squareMetres", "Square Metres", "number", { unit: "sqm" }),
          f("furnishing", "Furnishing", "multi_select", { options: ["Furnished", "Semi-Furnished", "Unfurnished"] }),
          f("condition", "Condition", "multi_select", { options: ["Fairly Used", "Newly Built"] })
        ]
      },
      {
        name: "Commercial Property For Sale",
        fields: [
          f("propertyType", "Property Type", "select", { options: ["Apartment", "Complex", "Factory", "Garage", "Hotel", "Maisonette", "Business Center", "Filling Station", "Hospital", "Hostel"] }),
          f("squareMetres", "Square Metres", "number", { unit: "sqm" }),
          f("furnishing", "Furnishing", "multi_select", { options: ["Furnished", "Semi-Furnished", "Unfurnished"] }),
          f("condition", "Condition", "multi_select", { options: ["Fairly Used", "Newly Built", "Off-Plan", "Old", "Uncompleted Building", "Under construction"] })
        ]
      }
    ]
  },

  // ---------------------------------------------------------------- 3. Phones & Tablets
  {
    name: "Phones & Tablets",
    children: [
      {
        name: "Mobile Phones",
        fields: [
          f("brand", "Brand", "select", { required: true, options: ["2E", "AEG", "Afrione", "Amazon", "Apple"] }),
          f("condition", "Condition", "multi_select", { required: true, options: CONDITION_STD }),
          f("internalStorage", "Internal Storage", "multi_select", { options: ["Under 4 GB", "8 GB", "64 GB", "512 GB"] }),
          f("ram", "Ram", "multi_select", { options: ["Under 1 GB", "3 GB", "4 GB", "6 GB", "8 GB", "24 GB"] }),
          f("exchangePossible", "Exchange Possible", "boolean"),
          f("color", "Color", "multi_select", { options: ["Black", "Blue", "Bronze", "Gold", "Graphite", "Gray"] }),
          f("classType", "Class", "multi_select", { options: ["Feature Phones", "Protected Phones", "Smartphones"] }),
          f("numberOfSims", "Number of SIMs", "multi_select", { options: ["Dual SIM", "Single SIM", "Triple SIM", "eSIM Only"] }),
          f("displayTechnology", "Display Technology", "multi_select", { options: ["AMOLED", "OLED", "IPS", "TFT", "PLS", "Monochrome"] }),
          f("displaySize", "Display Size", "multi_select", { options: ["<5\"", "5.1-5.5\"", "5.6-6\"", "6.1-6.5\"", "6.6-6.8\"", ">6.8\""] }),
          f("highlights", "Highlights", "multi_select", { options: ["5000 mAh+", "5G", "AMOLED", "Dual SIM", "eSIM", "NFC"] })
        ]
      },
      {
        name: "Tablets",
        fields: [
          f("brand", "Brand", "select", { required: true, options: ["ADSPEC", "AirTab", "Alldocube", "Allview", "Amazon", "Apple"] }),
          f("condition", "Condition", "multi_select", { required: true, options: CONDITION_STD }),
          f("screenSize", "Screen Size", "multi_select", { options: ["<7\"", "7-8.9\"", "9-10.9\"", "11-12.9\"", "13\"+"] }),
          f("color", "Color", "multi_select", { options: ["Black", "Blue", "Gray", "Green", "Pink", "Red"] }),
          f("storageCapacity", "Storage Capacity", "multi_select", { options: ["4 GB", "8 GB", "16 GB", "32 GB", "64 GB", "128 GB+"] }),
          f("operatingSystem", "Operating System", "multi_select", { options: ["Android", "iOS", "Windows", "Other"] }),
          f("ram", "RAM", "multi_select", { options: ["512 MB", "1 GB", "2 GB", "4 GB", "6 GB", "8 GB", "12 GB+"] }),
          f("exchangePossible", "Exchange Possible", "boolean"),
          f("displayTechnology", "Display Technology", "multi_select", { options: ["IPS", "TFT", "AMOLED", "TN", "OLED"] })
        ]
      },
      {
        name: "Smart Watches",
        fields: [
          f("brand", "Brand", "select", { required: true, options: ["Zeblaze", "Xiaomi", "Whoop", "UWatch"] }),
          f("type", "Type", "select", { required: true, options: ["Fitness Trackers", "Smart Watches", "Accessories"] }),
          f("bandColor", "Band Color", "multi_select", { options: ["Beige", "Black", "Blue", "Brown", "Gold", "Gray"] }),
          f("bandMaterial", "Band Material", "multi_select", { options: ["Aluminum", "Ceramic", "Faux Leather", "Genuine Leather", "Nylon", "Polyurethane"] }),
          f("condition", "Condition", "multi_select", { options: CONDITION_STD })
        ]
      },
      {
        name: "Headphones",
        fields: [
          f("brand", "Brand", "select", { required: true, options: ["1More", "A-Audio", "Abingo"] }),
          f("type", "Type", "multi_select", { required: true, options: ["In-Ear", "On-Ear", "Over-Ear"] }),
          f("formFactor", "Form Factor", "multi_select", { options: ["Ear-hook", "Headband", "In-Ear only", "Neckband"] }),
          f("connectivity", "Connectivity", "multi_select", { options: ["Wired", "Wired/Wireless", "Wireless"] }),
          f("connectingInterface", "Connecting Interface", "multi_select", { options: ["2.5mm", "3.5mm", "Bluetooth", "Lightning"] }),
          f("color", "Color", "multi_select", { options: ["Beige", "Black", "Blue", "Brown", "Gold", "Gray"] }),
          f("features", "Features", "multi_select", { options: ["Active Noise Cancellation", "AptX/AptX HD", "Hi-Res Audio", "NFC"] }),
          f("condition", "Condition", "multi_select", { options: ["Brand New", "For parts", "Refurbished", "Used"] }),
          f("highlights", "Highlights", "multi_select", { options: ["Gaming", "Studio", "Sports", "True Wireless"] })
        ]
      },
      {
        name: "Accessories for Phones & Tablets",
        fields: [
          f("type", "Type", "select", { required: true, options: ["Batteries", "Bluetooth Mono Headsets", "Cables", "Cases", "Chargers", "Charging Stations"] }),
          f("brand", "Brand", "multi_select", { required: true, options: ["8BitDo", "A+D", "A-Tach", "A4TECH", "Aastra"] }),
          f("condition", "Condition", "multi_select", { required: true, options: CONDITION_SIMPLE }),
          f("bulkPriceAvailable", "Bulk Price available", "boolean")
        ]
      }
    ]
  },

  // ---------------------------------------------------------------- 4. Electronics
  {
    name: "Electronics",
    children: [
      {
        name: "Laptops & Computers",
        fields: [
          f("type", "Type", "select", { required: true, options: ["Laptop", "Server", "Desktop Computer"] }),
          f("brand", "Brand", "select", { required: true, options: ["ABS", "Acer", "Advent", "Alienware", "Apple", "Asus"] }),
          f("condition", "Condition", "multi_select", { required: true, options: CONDITION_STD }),
          f("ram", "RAM", "multi_select", { options: ["1GB", "2GB", "4GB", "8GB", "16GB", "32GB", "64GB+"] }),
          f("processor", "Processor", "multi_select", { options: ["Intel Core", "Xeon", "Pentium", "Snapdragon", "Nvidia"] }),
          f("storageCapacity", "Storage Capacity", "multi_select", { options: ["16GB", "32GB", "64GB", "128GB", "256GB", "512GB", "1T", "2T", "6T"] }),
          f("displaySize", "Display Size", "multi_select", { options: ["10.1\"", "13\"/13.3\"", "15\"/15.6\"", "16\"", "19\"", ">21\""] }),
          f("storageType", "Storage Type", "multi_select", { options: ["eMMC", "HDD", "HDD+SSD", "SSD", "SSHD"] }),
          f("operatingSystem", "Operating System", "multi_select", { options: ["Windows 7", "Windows 8", "Windows 8.1", "Windows 10", "Windows 11", "XP"] }),
          f("graphicsCard", "Graphics Card", "multi_select", { options: ["Radeon RX series"] }),
          f("exchangePossible", "Exchange Possible", "boolean"),
          f("highlights", "Highlights", "multi_select", { options: ["For The Office", "For Gaming", "Long Battery Life", "Thin and Light"] })
        ]
      },
      {
        name: "TV & Video Equipment",
        fields: [
          f("type", "Type", "select", { required: true, options: ["Digital Signages", "TVs", "Projector", "Decoders", "TV DVR", "DVD Players"] }),
          f("brand", "Brand", "multi_select", { required: true, options: ["Zum", "Zkteco", "ZEG", "Xiaomi"] }),
          f("condition", "Condition", "multi_select", { options: CONDITION_STD }),
          f("exchangePossible", "Exchange Possible", "boolean")
        ]
      },
      {
        name: "Video Game Consoles",
        fields: [
          f("brand", "Brand", "multi_select", { required: true, options: ["Turtle Beach", "Thrustmaster", "Sony", "Sega", "Nvidia"] }),
          f("type", "Type", "select", { required: true, options: ["Game Consoles", "Game Controllers"] }),
          f("condition", "Condition", "multi_select", { required: true, options: CONDITION_SIMPLE }),
          f("exchangePossible", "Exchange Possible", "boolean")
        ]
      },
      {
        name: "Audio & Music Equipment",
        fields: [
          f("type", "Type", "select", { required: true, options: ["Acoustic Shields & Panels", "Amplifiers", "Audio Compressors", "Audio Interfaces", "Cassette/CD Players"] }),
          f("brand", "Brand", "multi_select", { required: true, options: ["1 BY ONE", "A11", "Accuphase"] }),
          f("condition", "Condition", "multi_select", { options: CONDITION_SIMPLE })
        ]
      },
      {
        name: "Photo & Video Cameras",
        fields: [
          f("type", "Type", "select", { required: true, options: ["Action Cameras", "Camera Lenses", "Digital Cameras", "Drones", "DSLR", "Film Cameras"] }),
          f("make", "Make", "multi_select", { required: true, options: ["AEE", "Alpa", "Alpha", "Andoer", "Andowl"] }),
          f("condition", "Condition", "multi_select", { options: CONDITION_STD })
        ]
      },
      {
        name: "Security & Surveillance",
        fields: [
          f("brand", "Brand", "multi_select", { required: true, options: ["101 Av Inc", "A-Zone", "Abtech", "Acceskings"] }),
          f("type", "Type", "select", { required: true, options: ["CCTV Kit", "Under Search Mirrors", "Door Sensors", "Spy Pen", "CCTV Camera", "IP Camera"] }),
          f("connectivity", "Connectivity", "multi_select", { options: ["Wireless", "Wired", "Wired/Wireless"] }),
          f("condition", "Condition", "multi_select", { options: ["Brand New", "Refurbished", "Used", "For parts"] })
        ]
      },
      {
        name: "Networking Products",
        fields: [
          f("brand", "Brand", "multi_select", { required: true, options: ["2Wire", "3Com", "9Mobile", "ACP", "Action-Tec"] }),
          f("type", "Type", "select", { required: true, options: ["Access Point", "IP Phones", "Mifi", "Modem", "Network Cables", "Router"] }),
          f("condition", "Condition", "multi_select", { options: CONDITION_STD })
        ]
      },
      {
        name: "Printers & Scanners",
        fields: [
          f("type", "Type", "select", { required: true, options: ["Dot-Matrix Printer", "Flatbed Scanner", "Ink-Jet Printer", "Laser Printer", "Photo Printer", "Photocopier"] }),
          f("brand", "Brand", "multi_select", { required: true, options: ["3D Systems", "3M", "Acer", "Adesso", "Agfa", "Alps"] }),
          f("condition", "Condition", "multi_select", { options: ["Brand New", "For parts", "Refurbished", "Used"] })
        ]
      },
      {
        name: "Computer Monitors",
        fields: [
          f("brand", "Brand", "select", { required: true, options: ["Acer", "Alienware", "AOC", "Apple", "Aser", "Asus"] }),
          f("resolution", "Resolution", "multi_select", { required: true, options: ["HD", "Full HD", "Quad HD", "4K", "8K"] }),
          f("screenSize", "Screen Size", "number", { unit: "in" }),
          f("aspectRatio", "Aspect Ratio", "multi_select", { options: ["16:10", "16:9", "21:9", "4:3", "5:4"] }),
          f("displayTechnology", "Display Technology", "multi_select", { options: ["CRT", "IPS", "OLED", "VA"] }),
          f("refreshRate", "Refresh Rate", "multi_select", { options: ["50Hz", "60Hz", "75Hz", "120Hz", "144Hz", "240Hz"] }),
          f("videoInput", "Video Input", "multi_select", { options: ["Display Port", "DVI-D", "HDMI", "USB", "VGA"] }),
          f("condition", "Condition", "multi_select", { options: ["Brand New", "For parts", "Refurbished", "Used"] })
        ]
      },
      {
        name: "Computer Hardware",
        fields: [
          f("brand", "Brand", "multi_select", { required: true, options: ["1byone", "2-POWER", "3Com", "3DLABS"] }),
          f("type", "Type", "select", { required: true, options: ["CD/DVD Drives", "Computer Cases", "Cooling Fans", "CPU Processors", "HDD"] }),
          f("condition", "Condition", "select", { required: true, options: CONDITION_STD })
        ]
      },
      {
        name: "Computer Accessories",
        fields: [
          f("brand", "Brand", "multi_select", { required: true, options: ["4K", "4K Ultrahd", "Acer", "Adesso", "Airsky"] }),
          f("type", "Type", "select", { required: true, options: ["Adapters", "Barcode Printers", "Batteries", "Blank CDs/DVDs", "Cables", "Capture Cards"] }),
          f("condition", "Condition", "multi_select", { options: CONDITION_SIMPLE }),
          f("bulkPriceAvailable", "Bulk Price available", "boolean")
        ]
      },
      {
        name: "Accessories & Supplies for Electronics",
        fields: [
          f("type", "Type", "select", { required: true, options: ["Audio & Music Accessories", "Game Console Accessories", "Headphone Accessories", "Networking Accessories", "Photo & Video Accessories"] }),
          f("brand", "Brand", "multi_select", { options: ["4K Hdmi Splitter", "Abb", "Accsoon", "Acer"] }),
          f("condition", "Condition", "multi_select", { options: ["Brand New", "For parts", "Refurbished", "Used"] })
        ]
      },
      {
        name: "Video Games",
        fields: [
          f("platform", "Platform", "multi_select", { required: true, options: ["Xbox", "Xbox 360", "Xbox One", "Nintendo 3DS", "Nintendo Switch", "PC"] }),
          f("genre", "Genre", "multi_select", { required: true, options: ["Action", "Adventure", "Arcade", "Fighting", "Horror", "Racing"] }),
          f("rating", "Rating", "multi_select", { options: ["AO", "E", "E10+", "M"] }),
          f("releaseYear", "Release Year", "select", { options: ["2020", "2021", "2022", "2023", "2024", "2025"] }),
          f("condition", "Condition", "multi_select", { options: CONDITION_SIMPLE }),
          f("exchangePossible", "Exchange Possible", "boolean")
        ]
      },
      {
        name: "Software",
        fields: [
          f("platform", "Platform", "multi_select", { required: true, options: ["Android", "iOS", "Linux", "Mac", "Windows"] }),
          f("type", "Type", "multi_select", { options: ["3D Modeling", "Accounting", "Antivirus", "Cloud Service", "Design", "Graphics Editor"] }),
          f("format", "Format", "multi_select", { options: ["CD", "Digital Download", "DVD", "E-Mail", "Product Key Card", "Subscription"] })
        ]
      }
    ]
  },

  // ---------------------------------------------------------------- 5. Home, Furniture & Appliances
  {
    name: "Home, Furniture & Appliances",
    children: [
      {
        name: "Furniture",
        fields: [
          f("type", "Type", "select", { required: true, options: ["Armchairs", "Bag Racks", "Bar Carts", "Bed Headboards", "Beds & Bed Frames", "Benches/Stools"] }),
          f("condition", "Condition", "multi_select", { required: true, options: CONDITION_SIMPLE }),
          f("room", "Room", "multi_select", { required: true, options: ["Attic", "Balcony", "Basement", "Bathroom", "Bedroom", "Dining Room"] }),
          f("material", "Material", "multi_select", { options: ["ABS", "Acrylic", "Aluminum", "Particle Board", "Iron", "Metal"] }),
          f("brand", "Brand", "multi_select", { options: ["Zuo Modern", "Zojirushi", "Zodiac", "Zinus"] }),
          f("color", "Color", "multi_select", { options: ["Black", "Blue", "Brown", "Gold", "Gray", "Green"] }),
          f("bulkPriceAvailable", "Bulk Price available", "boolean")
        ]
      },
      {
        name: "Lighting",
        fields: [
          f("type", "Type", "select", { required: true, options: ["Ceiling Lights", "Chandeliers", "Desk Lamps", "Emergency Lights", "Floodlights", "Floor Lamps"] }),
          f("condition", "Condition", "select", { required: true, options: CONDITION_SIMPLE }),
          f("brand", "Brand", "multi_select", { options: ["AEC", "AFX Lighting", "Amerlux", "Anglepoise", "Ansell"] }),
          f("features", "Features", "multi_select", { options: ["Color Changing", "Daylight Sensor", "Dimmable", "Flicker-free", "Foldable"] })
        ]
      },
      {
        name: "Storage & Organization",
        fields: [
          f("type", "Type", "select", { options: ["Hangers", "Waste Bins", "Buckets", "Shoe Racks", "Laundry Baskets", "Storage Boxes"] })
        ]
      },
      {
        name: "Home Accessories",
        fields: [
          f("type", "Type", "select", { required: true, options: ["3D Wall Panels", "Air Fresheners", "Bath Mats", "Bathroom Textiles", "Bedding", "Candle Holders"] }),
          f("condition", "Condition", "multi_select", { required: true, options: CONDITION_SIMPLE }),
          f("brand", "Brand", "multi_select", { required: true, options: ["A Nice Night", "A&S", "Abercrombie & Ferguson", "Adairs"] }),
          f("bulkPriceAvailable", "Bulk Price available", "boolean")
        ]
      },
      {
        name: "Home Appliances",
        fields: [
          f("type", "Type", "select", { required: true, options: ["Air Conditioners", "Air Coolers", "Air Purifiers", "Alarm Systems", "Bathroom Scales", "Dehumidifiers"] }),
          f("brand", "Brand", "multi_select", { required: true, options: ["2gig", "3M", "3Q", "4walls", "A&Bt"] }),
          f("condition", "Condition", "multi_select", { options: CONDITION_STD })
        ]
      },
      {
        name: "Kitchen Appliances",
        fields: [
          f("type", "Type", "select", { required: true, options: ["Air Fryers", "Blenders", "Bread Makers", "Breakfast Machines", "Canisters", "Chafing Dishes"] }),
          f("condition", "Condition", "multi_select", { required: true, options: ["Brand New", "For parts", "Refurbished", "Used"] }),
          f("brand", "Brand", "multi_select", { required: true, options: ["3M", "A&S", "AbsorbaStone", "Accoutrements", "ACE", "Acme"] })
        ]
      },
      {
        name: "Kitchenware & Cookware",
        fields: [
          f("type", "Type", "select", { required: true, options: ["Aprons", "Bowls", "Kettles & Teapots", "Cutting Boards", "Bottle Stoppers", "Canisters & Jars"] }),
          f("condition", "Condition", "select", { required: true, options: CONDITION_SIMPLE }),
          f("brand", "Brand", "multi_select", { options: ["3M", "AbsorbaStone", "Accoutrements", "Accurate"] }),
          f("color", "Color", "multi_select", { options: ["Black", "Brown", "Blue", "Gold", "Silver", "Green"] })
        ]
      },
      {
        name: "Household Chemicals",
        fields: [
          f("brand", "Brand", "multi_select", { required: true, options: ["Abro", "ACE", "Admiral", "Aerus", "AfriDet", "Air Wick"] }),
          f("type", "Type", "select", { required: true, options: ["Bathroom Cleaners", "Bleach", "Carpet & Rug Cleaners", "Descalers", "Dishwasher Detergents", "Disinfectants"] }),
          f("form", "Form", "multi_select", { options: ["Capsules", "Concentrate", "Crystals", "Gel", "Granules/Pellets", "Liquid"] })
        ]
      },
      {
        name: "Garden Supplies",
        fields: [
          f("type", "Type", "select", { required: true, options: ["Artificial Grass", "Artificial Plants", "Canopies", "Flower Pots", "Garden & Lawn Stakes", "Garden Edging"] }),
          f("condition", "Condition", "multi_select", { required: true, options: CONDITION_SIMPLE }),
          f("brand", "Brand", "multi_select", { options: ["A B TOOLS", "ACE", "AgroMax", "Allen", "AmazonBasics", "AMES"] })
        ]
      }
    ]
  },

  // ---------------------------------------------------------------- 6. Fashion
  {
    name: "Fashion",
    children: [
      {
        name: "Women's Fashion",
        children: [
          {
            name: "Women's Clothing",
            fields: [
              f("type", "Type", "select", { required: true, options: ["Activewear & Sportswear", "Blazers", "Blouses", "Corsets", "Dresses", "Fabrics"] }),
              f("brand", "Brand", "multi_select", { required: true, options: ["100K", "11Kn", "4F", "A&D", "Abc"] }),
              f("color", "Color", "multi_select", { required: true, options: ["Ash", "Azure", "Baby Blue", "Beige", "Black", "Blue"] }),
              f("style", "Style", "multi_select", { required: true, options: ["Androgynous", "Boho", "Casual", "Classic", "Cowgirl/Cowboy", "Edgy"] }),
              f("condition", "Condition", "multi_select", { options: CONDITION_SIMPLE }),
              f("size", "Size", "multi_select", { options: ["3XS", "XXS", "XS", "S", "M", "L+"] }),
              f("material", "Material", "multi_select", { options: ["Yak", "Wool", "Wire", "Voile Lace", "Voile"] })
            ]
          },
          {
            name: "Women's Shoes",
            fields: [
              f("type", "Type", "select", { required: true, options: ["Ankle Boots", "Army Boots", "Ballerinas", "Ballet Shoes", "Barefoot Shoes", "Basketball Shoes"] }),
              f("gender", "Gender", "multi_select", { required: true, options: ["Women's", "Men's", "Unisex"] }),
              f("brand", "Brand", "multi_select", { required: true, options: ["A Bathing Ape", "Aaronfaiy", "Abryanz", "Achock", "Adidas"] }),
              f("condition", "Condition", "multi_select", { options: CONDITION_SIMPLE }),
              f("size", "Size", "multi_select", { options: ["One Size", "2", "3", "4+"] }),
              f("color", "Color", "multi_select", { options: ["Ash", "Baby Blue", "Beige", "Black", "Blue"] })
            ]
          },
          {
            name: "Women's Clothing Accessories",
            fields: [
              f("brand", "Brand", "multi_select", { required: true, options: ["58Mm", "Acqua di Stresa", "Adidas", "Adire", "Adot"] }),
              f("type", "Type", "select", { options: ["Belt Buckles", "Belts", "Buttons", "Cuff Links", "Gift Boxes", "Gloves & Mittens"] }),
              f("gender", "Gender", "multi_select", { options: ["Women's", "Men's", "Unisex"] }),
              f("color", "Color", "multi_select", { options: ["Beige", "Black", "Blue", "Brown", "Clear", "Gold"] }),
              f("condition", "Condition", "multi_select", { options: CONDITION_SIMPLE })
            ]
          },
          {
            name: "Women's Bags",
            fields: [
              f("gender", "Gender", "multi_select", { required: true, options: ["Women's", "Men's", "Unisex"] }),
              f("brand", "Brand", "multi_select", { required: true, options: ["Adidas", "Adrienne Vittadini", "Akube", "Alba Handbags", "Aldo"] }),
              f("type", "Type", "select", { required: true, options: ["Ankara Bags", "Art & Poster Tubes", "Baby & Diaper Bags", "Backpacks", "Barrel Bags"] }),
              f("color", "Color", "multi_select", { options: ["Ash", "Azure", "Baby Blue", "Beige", "Black", "Blue"] }),
              f("condition", "Condition", "multi_select", { options: CONDITION_SIMPLE }),
              f("bulkPriceAvailable", "Bulk Price available", "boolean")
            ]
          },
          {
            name: "Women's Jewelry",
            fields: [
              f("brand", "Brand", "multi_select", { required: true, options: ["A BATHING APE", "A New Day", "A&BC", "A&G"] }),
              f("type", "Type", "select", { required: true, options: ["Bangles", "Beaded Jewelry", "Body Piercing Jewellery", "Bracelets", "Brooches", "Chains"] }),
              f("mainMaterial", "Main Material", "multi_select", { options: ["Acrylic", "Alloy", "Brass", "Cobalt", "Copper", "Glass"] }),
              f("color", "Color", "multi_select", { options: ["Yellow", "White", "Violet", "Silver", "Red", "Purple"] }),
              f("condition", "Condition", "multi_select", { options: CONDITION_SIMPLE }),
              f("exchangePossible", "Exchange Possible", "boolean")
            ]
          },
          {
            name: "Women's Watches",
            fields: [
              f("brand", "Brand", "select", { required: true, options: ["Acnos", "Adidas", "Aigner", "Aimecor", "Akribos XXIV"] }),
              f("gender", "Gender", "multi_select", { required: true, options: ["Women's", "Men's", "Unisex"] }),
              f("movement", "Movement", "multi_select", { options: ["Mechanical", "Quartz"] }),
              f("display", "Display", "multi_select", { options: ["Analog", "Analog & Digital", "Digital"] }),
              f("bandColor", "Band Color", "multi_select", { options: ["Black", "Blue", "Brown", "Gold", "Gray", "Green"] }),
              f("bandMaterial", "Band Material", "multi_select", { options: ["Aluminum", "Ceramic", "Faux Leather", "Genuine Leather", "Nylon"] }),
              f("style", "Style", "multi_select", { options: ["Business", "Casual", "Sport", "Other"] }),
              f("condition", "Condition", "multi_select", { options: ["Brand New", "For parts", "Refurbished", "Used"] })
            ]
          },
          {
            name: "Women's Wedding Wear & Accessories",
            fields: [
              f("gender", "Gender", "multi_select", { required: true, options: ["Women's", "Men's", "Unisex"] }),
              f("type", "Type", "select", { required: true, options: ["Bouquets", "Bridal Dresses", "Bridal Jewelry", "Bridal Robes", "Bridesmaid Dresses", "Rings"] }),
              f("condition", "Condition", "multi_select", { required: true, options: CONDITION_SIMPLE }),
              f("brand", "Brand", "multi_select", { options: ["Adrianna Papell", "Alex Evenings", "Amazon Essentials", "Amsale"] })
            ]
          }
        ]
      },
      {
        name: "Men's Fashion",
        children: [
          { name: "Men's Clothing", fields: [
            f("type", "Type", "select", { required: true, options: ["Activewear & Sportswear", "Blazers", "Shirts", "Suits", "Jackets", "Fabrics"] }),
            f("brand", "Brand", "multi_select", { required: true, options: ["100K", "11Kn", "4F", "A&D", "Abc"] }),
            f("color", "Color", "multi_select", { required: true, options: ["Ash", "Azure", "Baby Blue", "Beige", "Black", "Blue"] }),
            f("style", "Style", "multi_select", { required: true, options: ["Casual", "Classic", "Edgy", "Formal", "Sporty"] }),
            f("condition", "Condition", "multi_select", { options: CONDITION_SIMPLE }),
            f("size", "Size", "multi_select", { options: ["3XS", "XXS", "XS", "S", "M", "L+"] }),
            f("material", "Material", "multi_select", { options: ["Yak", "Wool", "Wire", "Voile Lace", "Voile"] })
          ]},
          { name: "Men's Shoes", fields: [
            f("type", "Type", "select", { required: true, options: ["Ankle Boots", "Army Boots", "Basketball Shoes", "Boots", "Loafers", "Sneakers"] }),
            f("gender", "Gender", "multi_select", { required: true, options: ["Women's", "Men's", "Unisex"] }),
            f("brand", "Brand", "multi_select", { required: true, options: ["A Bathing Ape", "Aaronfaiy", "Abryanz", "Achock", "Adidas"] }),
            f("condition", "Condition", "multi_select", { options: CONDITION_SIMPLE }),
            f("size", "Size", "multi_select", { options: ["One Size", "40", "41", "42+"] }),
            f("color", "Color", "multi_select", { options: ["Ash", "Baby Blue", "Beige", "Black", "Blue"] })
          ]},
          { name: "Men's Clothing Accessories", fields: [
            f("brand", "Brand", "multi_select", { required: true, options: ["58Mm", "Acqua di Stresa", "Adidas", "Adire", "Adot"] }),
            f("type", "Type", "select", { options: ["Belt Buckles", "Belts", "Buttons", "Cuff Links", "Gift Boxes", "Gloves & Mittens"] }),
            f("gender", "Gender", "multi_select", { options: ["Women's", "Men's", "Unisex"] }),
            f("color", "Color", "multi_select", { options: ["Beige", "Black", "Blue", "Brown", "Clear", "Gold"] }),
            f("condition", "Condition", "multi_select", { options: CONDITION_SIMPLE })
          ]},
          { name: "Men's Bags", fields: [
            f("gender", "Gender", "multi_select", { required: true, options: ["Women's", "Men's", "Unisex"] }),
            f("brand", "Brand", "multi_select", { required: true, options: ["Adidas", "Adrienne Vittadini", "Akube", "Alba Handbags", "Aldo"] }),
            f("type", "Type", "select", { required: true, options: ["Backpacks", "Briefcases", "Duffel Bags", "Messenger Bags", "Travel Bags"] }),
            f("color", "Color", "multi_select", { options: ["Ash", "Azure", "Baby Blue", "Beige", "Black", "Blue"] }),
            f("condition", "Condition", "multi_select", { options: CONDITION_SIMPLE }),
            f("bulkPriceAvailable", "Bulk Price available", "boolean")
          ]},
          { name: "Men's Jewelry", fields: [
            f("brand", "Brand", "multi_select", { required: true, options: ["A BATHING APE", "A New Day", "A&BC", "A&G"] }),
            f("type", "Type", "select", { required: true, options: ["Bracelets", "Chains", "Cufflinks", "Rings", "Tie Clips"] }),
            f("mainMaterial", "Main Material", "multi_select", { options: ["Acrylic", "Alloy", "Brass", "Cobalt", "Copper", "Glass"] }),
            f("color", "Color", "multi_select", { options: ["Yellow", "White", "Silver", "Black", "Gold"] }),
            f("condition", "Condition", "multi_select", { options: CONDITION_SIMPLE }),
            f("exchangePossible", "Exchange Possible", "boolean")
          ]},
          { name: "Men's Watches", fields: [
            f("brand", "Brand", "select", { required: true, options: ["Acnos", "Adidas", "Aigner", "Aimecor", "Akribos XXIV"] }),
            f("gender", "Gender", "multi_select", { required: true, options: ["Women's", "Men's", "Unisex"] }),
            f("movement", "Movement", "multi_select", { options: ["Mechanical", "Quartz"] }),
            f("display", "Display", "multi_select", { options: ["Analog", "Analog & Digital", "Digital"] }),
            f("bandColor", "Band Color", "multi_select", { options: ["Black", "Blue", "Brown", "Gold", "Gray", "Green"] }),
            f("bandMaterial", "Band Material", "multi_select", { options: ["Aluminum", "Ceramic", "Faux Leather", "Genuine Leather", "Nylon"] }),
            f("style", "Style", "multi_select", { options: ["Business", "Casual", "Sport", "Other"] }),
            f("condition", "Condition", "multi_select", { options: ["Brand New", "For parts", "Refurbished", "Used"] })
          ]},
          { name: "Men's Wedding Wear & Accessories", fields: [
            f("gender", "Gender", "multi_select", { required: true, options: ["Women's", "Men's", "Unisex"] }),
            f("type", "Type", "select", { required: true, options: ["Suits", "Ties", "Bow Ties", "Cufflinks", "Shoes"] }),
            f("condition", "Condition", "multi_select", { required: true, options: CONDITION_SIMPLE }),
            f("brand", "Brand", "multi_select", { options: ["Adrianna Papell", "Alex Evenings", "Amazon Essentials", "Amsale"] })
          ]}
        ]
      },
      {
        name: "Baby & Kids' Fashion",
        children: [
          {
            name: "Children's Clothing",
            fields: [
              f("brand", "Brand", "multi_select", { required: true, options: ["2B Real", "2XU", "3M", "3pommes", "5th & Ocean", "686"] }),
              f("type", "Type", "select", { required: true, options: ["Agbada", "Anti-Scratch Mittens", "Ball Gowns", "Ballet Camisole", "Ballet Dresses", "Bathrobes"] }),
              f("age", "Age", "multi_select", { options: ["0-3M", "3-6M", "6-12M", "1-2Y", "2-4Y", "4-6Y", "6-10Y", "10-16Y"] }),
              f("material", "Material", "multi_select", { options: ["Acetate", "Alginate", "Alpaca", "Angora", "Animal Hair", "Bamboo"] }),
              f("color", "Color", "multi_select", { options: ["Black", "Blue", "Brown", "Gold", "Gray", "Green"] }),
              f("condition", "Condition", "select", { options: CONDITION_SIMPLE })
            ]
          },
          {
            name: "Children's Shoes",
            fields: [
              f("brand", "Brand", "multi_select", { required: true, options: ["2K", "3M", "A&BC", "A&G", "Abercrombie & Fitch"] }),
              f("type", "Type", "select", { required: true, options: ["Baby Shoes", "Ballet Flats", "Boots", "Clogs", "Flats Shoes", "Flip Flops"] }),
              f("gender", "Gender", "multi_select", { required: true, options: ["Girls", "Boys", "Unisex"] }),
              f("size", "Size", "multi_select", { options: ["1", "2", "3", "…", "35+"] }),
              f("color", "Color", "multi_select", { options: ["Black", "Blue", "Brown", "Gold", "Gray", "Green"] }),
              f("condition", "Condition", "multi_select", { options: CONDITION_SIMPLE })
            ]
          },
          {
            name: "Babies & Kids Accessories",
            fields: [
              f("type", "Type", "select", { required: true, options: ["Baby Banda", "Baby Jewelry", "Bags", "Belts", "Bibs", "Children Party Packs"] }),
              f("condition", "Condition", "multi_select", { required: true, options: CONDITION_SIMPLE }),
              f("color", "Color", "multi_select", { options: ["Yellow", "White", "Silver", "Red", "Purple", "Pink"] })
            ]
          }
        ]
      }
    ]
  },

  // ---------------------------------------------------------------- 7. Beauty & Personal Care
  {
    name: "Beauty & Personal Care",
    children: [
      { name: "Hair Beauty", fields: [
        f("brand", "Brand", "multi_select", { required: true }),
        f("type", "Type", "select", { required: true }),
        f("gender", "Gender", "select", { options: ["Female", "Male", "Unisex"] })
      ]},
      { name: "Face Care", fields: [
        f("brand", "Brand", "multi_select", { required: true }),
        f("type", "Type", "select", { required: true }),
        f("gender", "Gender", "multi_select", { required: true, options: ["Women's", "Men's", "Unisex"] })
      ]},
      { name: "Oral Care", fields: [
        f("brand", "Brand", "multi_select"),
        f("type", "Type", "select", { required: true })
      ]},
      { name: "Body Care", fields: [
        f("brand", "Brand", "multi_select"),
        f("type", "Type", "select", { required: true })
      ]},
      { name: "Fragrance", fields: [
        f("brand", "Brand", "multi_select"),
        f("type", "Type", "select", { required: true }),
        f("perfumeType", "Perfume Type", "multi_select", { options: ["Eau de Cologne", "Eau de Fraiche", "Eau de Parfum", "Eau de Toilette", "Essential Oils", "Parfum"] }),
        f("gender", "Gender", "multi_select", { required: true, options: ["Women's", "Men's", "Unisex"] }),
        f("scent", "Scent", "multi_select", { options: ["Citrus", "Floral", "Fruity", "Oceanic", "Oriental", "Spicy"] }),
        f("volume", "Volume", "number", { unit: "ml" }),
        f("formulation", "Formulation", "multi_select", { options: ["Oil", "Pencil", "Rollerball", "Spray"] })
      ]},
      { name: "Makeup", fields: [
        f("brand", "Brand", "multi_select"),
        f("type", "Type", "select", { required: true }),
        f("gender", "Gender", "multi_select", { options: ["Women's", "Men's", "Unisex"] })
      ]},
      { name: "Sexual Wellness", fields: [
        f("brand", "Brand", "multi_select"),
        f("type", "Type", "select", { required: true })
      ]},
      { name: "Tools & Accessories", fields: [
        f("brand", "Brand", "multi_select"),
        f("type", "Type", "select", { required: true })
      ]},
      { name: "Vitamins & Supplements", fields: [
        f("brand", "Brand", "multi_select"),
        f("type", "Type", "select", { required: true }),
        f("formulation", "Formulation", "multi_select", { required: true, options: ["Caplet", "Capsule", "Chewable", "Cream", "Crystal", "Drink"] }),
        f("ageGroup", "Age Group", "multi_select", { options: ["All", "Baby", "Toddler", "Kids", "Teens", "Adult"] }),
        f("flavor", "Flavor", "multi_select"),
        f("whenToTake", "When to Take", "multi_select", { options: ["After Meal", "Before Meal", "During Meal", "After Workout", "Before Workout"] })
      ]},
      { name: "Massagers", fields: [
        f("brand", "Brand", "multi_select"),
        f("type", "Type", "select", { required: true }),
        f("massagerType", "Massager Type", "multi_select", { options: ["Anti-Cellulite", "Body Roller", "Massage Gun", "Eye Massager", "Face Roller", "Head & Scalp"] }),
        f("bodyArea", "Body Area", "multi_select", { options: ["Head", "Wrist", "Shoulder", "Eyes", "Foot", "Legs"] }),
        f("condition", "Condition", "multi_select", { options: CONDITION_SIMPLE })
      ]}
    ]
  },

  // ---------------------------------------------------------------- 8. Repair & Construction
  {
    name: "Repair & Construction",
    children: [
      {
        name: "Electrical Equipment",
        fields: [
          f("brand", "Brand", "multi_select", { options: ["Zurn", "Zonergy", "Zodiac", "Zipper", "Zinsco", "Zenith"] }),
          f("condition", "Condition", "multi_select", { required: true, options: CONDITION_STD })
        ],
        children: [
          { name: "Generators", fields: [f("type", "Type", "select", { required: true, options: ["Alternators", "Generators", "Soundproof Generators", "Steam Generators"] })] },
          { name: "Solar & Renewable", fields: [f("type", "Type", "select", { required: true })] },
          { name: "Inverters & Backup Batteries", fields: [f("type", "Type", "select", { required: true })] },
          { name: "Switches, Sockets & Distribution", fields: [f("type", "Type", "select", { required: true })] },
          { name: "Stabilizers & Voltage Protection", fields: [f("type", "Type", "select", { required: true })] },
          { name: "Welding Machinery & Construction", fields: [f("type", "Type", "select", { required: true })] },
          { name: "Industrial Electrical & Automation", fields: [f("type", "Type", "select", { required: true })] },
          { name: "Electronic Components & Sensors", fields: [f("type", "Type", "select", { required: true })] },
          { name: "Cables & Wires", fields: [f("type", "Type", "select", { required: true })] }
        ]
      },
      {
        name: "Building Materials & Supplies",
        fields: [
          f("brand", "Brand", "multi_select", { required: true, options: ["Alta Power", "Crestanks", "Dangote", "Dr Fixit", "Geonor", "Hima Cement"] }),
          f("type", "Type", "select", { required: true, options: ["3D Panels", "Aluminum Profiles", "Blocks", "Bricks", "Carports", "Ceiling"] }),
          f("bulkPriceAvailable", "Bulk Price available", "boolean")
        ]
      },
      {
        name: "Plumbing & Water Systems",
        fields: [
          f("type", "Type", "select", { options: ["Bathtubs", "Bidets", "Borehole Drilling Equipment", "Drainage", "Floor Drains", "Gaskets & Seal Tapes"] }),
          f("brand", "Brand", "multi_select", { options: ["Abb", "Abey", "ACE", "Acme", "Adams", "Adelphi"] }),
          f("condition", "Condition", "multi_select", { required: true, options: CONDITION_SIMPLE })
        ]
      },
      {
        name: "Electrical Hand Tools",
        fields: [
          f("brand", "Brand", "multi_select", { required: true, options: ["3M", "Abb", "Abbott & Ashby", "Acdelco", "Ace"] }),
          f("type", "Type", "select", { required: true, options: ["Air Blowers", "Angle Grinders", "Angle Polishers", "Biscuit Joiners", "Blades", "Chainsaws"] }),
          f("condition", "Condition", "multi_select", { options: CONDITION_STD })
        ]
      },
      {
        name: "Hand Tools",
        fields: [
          f("type", "Type", "select", { required: true, options: ["Automotive Tools", "Axes", "Band Saws", "Bolt Cutters", "Cable Cutters", "Cable Lugs"] }),
          f("brand", "Brand", "multi_select", { required: true, options: ["3M", "Abro", "ACDelco", "Ace", "Acme", "Adams"] }),
          f("condition", "Condition", "multi_select", { options: CONDITION_SIMPLE }),
          f("bulkPriceAvailable", "Bulk Price available", "boolean")
        ]
      },
      {
        name: "Measuring & Testing Tools",
        fields: [
          f("type", "Type", "select", { required: true, options: ["Auto Level", "Battery Tester", "Cable Tracker", "Caliper", "Check Meter", "Clamp Meters"] }),
          f("brand", "Brand", "multi_select", { options: ["3M", "ADA Instruments", "AEMC", "Agilent", "AMES", "Amprobe"] }),
          f("condition", "Condition", "multi_select", { required: true, options: CONDITION_SIMPLE })
        ]
      },
      {
        name: "Hardware & Fasteners",
        fields: [
          f("type", "Type", "select", { options: ["Brackets & Joining Plates", "Fastening Pins", "Mounting Tapes", "Nails", "Nuts", "Other"] })
        ]
      },
      {
        name: "Doors & Security",
        fields: [
          f("brand", "Brand", "multi_select", { required: true, options: ["ADT", "Allegion", "Alta Power", "Amarr", "Arlo", "Black & Decker"] }),
          f("type", "Type", "select", { required: true, options: ["Bathroom & Toilet Doors", "Door Closers", "Door Hinges", "Door Knobs & Levers", "Door Locks", "Door Viewers"] }),
          f("color", "Color", "multi_select", { required: true, options: ["Beige", "Black", "Blue", "Brown", "Gold", "Gray"] }),
          f("material", "Material", "multi_select", { options: ["Aluminum", "Brass", "Composite", "Copper", "Glass", "Iron"] }),
          f("condition", "Condition", "multi_select", { options: CONDITION_SIMPLE })
        ]
      },
      {
        name: "Windows & Glass",
        fields: [
          f("windowStyle", "Window Style", "multi_select", { options: ["Awning", "Bay", "Bi-Fold", "Casement", "Double-Hung", "Fixed"] }),
          f("brand", "Brand", "multi_select", { required: true, options: ["Alta Power", "Geonor", "Megfin", "Novo Abrasive", "Oska Rio", "Shakti"] }),
          f("typeOfGlass", "Type of Glass", "multi_select", { required: true, options: ["Armoured", "Float", "Heat Retention Coating", "Laminated", "Obscure", "Reflective"] }),
          f("glazingType", "Glazing Type", "multi_select", { required: true, options: ["Clear Glass", "Laminated Glass", "Low-E", "Obscure Glass", "Tempered Glass"] }),
          f("shape", "Shape", "select", { required: true, options: ["Circle", "Half Circle", "Pentagone", "Rectangle", "Square", "Triangle"] }),
          f("frameMaterial", "Frame Material", "multi_select", { options: ["Aluminum", "Fiberglass", "Stainless Steel", "Vinyl", "Wood"] }),
          f("condition", "Condition", "multi_select", { options: CONDITION_SIMPLE })
        ]
      },
      {
        name: "Other Repair & Construction Items",
        fields: [
          f("brand", "Brand", "multi_select", { required: true, options: ["Abro", "Megfin", "ONCCY", "Oska Rio", "Rushi Technology", "Other"] }),
          f("condition", "Condition", "multi_select", { required: true, options: CONDITION_SIMPLE })
        ]
      }
    ]
  },

  // ---------------------------------------------------------------- 9. Commercial Equipment & Tools
  {
    name: "Commercial Equipment & Tools",
    children: [
      { name: "Medical Equipment & Supplies", fields: [
        f("type", "Type", "select", { required: true, options: ["Accessories for Medical Equipment", "Ambulance Stretchers", "Anesthesia Equipment", "Aspirator", "Baby Scales", "Blood Analyzers"] }),
        f("condition", "Condition", "multi_select", { required: true, options: CONDITION_STD })
      ]},
      { name: "Safety Equipment & Protective Gear", fields: [
        f("type", "Type", "select", { required: true, options: ["Alarm Systems", "Baggage Scanners", "Barriers", "Biometric Machines", "Card Lock Systems", "Caution Tapes"] }),
        f("brand", "Brand", "multi_select"),
        f("condition", "Condition", "multi_select", { required: true, options: CONDITION_STD })
      ]},
      { name: "Manufacturing Equipment", fields: [
        f("type", "Type", "select", { required: true, options: ["Bag Closers", "Bottle Making Machines", "Bread Slicer Machines", "Capping Machines", "CNC Router Machines", "Coating Machines"] }),
        f("condition", "Condition", "multi_select", { required: true, options: CONDITION_STD })
      ]},
      { name: "Manufacturing Materials & Supplies", fields: [
        f("type", "Type", "select", { options: ["Bottle Caps", "Bubble Wrap", "Buckets", "Charcoal", "Chemical Drums", "Fiberglass"] }),
        f("condition", "Condition", "multi_select", { required: true, options: CONDITION_STD })
      ]},
      { name: "Retail & Store Equipment", fields: [
        f("type", "Type", "select", { required: true, options: ["Anti-Theft Equipment", "Barcode Scanners", "Bill Counters", "Cash Registers", "Checkout Counters", "Commercial Scales"] }),
        f("condition", "Condition", "multi_select", { required: true, options: CONDITION_STD })
      ]},
      { name: "Restaurant & Catering Equipment", fields: [
        f("brand", "Brand", "multi_select"),
        f("type", "Type", "select", { required: true, options: ["Barbecue", "Beverage Dispensers", "Blast Chillers", "Blenders", "Bone Saw Machines", "Bottle Coolers"] }),
        f("condition", "Condition", "multi_select", { required: true, options: CONDITION_STD })
      ]},
      { name: "Stationery & Office Equipment", fields: [
        f("type", "Type", "select", { options: ["Binders", "Calculators", "Calendars", "Copy & Printer Paper", "Document Racks", "Dry Erase Boards"] }),
        f("condition", "Condition", "multi_select", { required: true, options: CONDITION_STD })
      ]},
      { name: "Salon & Beauty Equipment", fields: [
        f("type", "Type", "select", { options: ["Barber Chairs", "Facial Machines", "Hair Wash Basins", "Hair Dryers", "Massage Beds", "Mirrors"] }),
        f("condition", "Condition", "multi_select", { required: true, options: CONDITION_STD })
      ]},
      { name: "Printing & Graphics Equipment", fields: [
        f("type", "Type", "select", { required: true, options: ["3D Printers", "Ceramic Printers", "DI Machines", "Heat Presses", "Industrial Printers", "Plastic Card Printers"] }),
        f("condition", "Condition", "multi_select", { required: true, options: CONDITION_STD })
      ]},
      { name: "Stage & Event Equipment", fields: [
        f("type", "Type", "select", { options: ["Bubble Machines", "Color Light Filters", "Foam Machines", "Fog Machines", "Followspot Lights", "LED Screen Panels"] }),
        f("condition", "Condition", "multi_select", { required: true, options: CONDITION_STD })
      ]}
    ]
  },

  // ---------------------------------------------------------------- 10. Leisure & Activities
  {
    name: "Leisure & Activities",
    children: [
      { name: "Sports Equipment", fields: [
        f("type", "Type", "select", { required: true, options: ["Ab Exercise Machine", "Ab Rollers", "Agility Ladders", "Air Hockey Tables", "Arm Blasters", "Badminton Nets"] }),
        f("brand", "Brand", "multi_select"),
        f("condition", "Condition", "multi_select", { required: true, options: CONDITION_SIMPLE })
      ]},
      { name: "Musical Instruments & Gear", fields: [
        f("brand", "Brand", "multi_select"),
        f("type", "Type", "select", { required: true, options: ["Acoustic Drum Sets", "Acoustic Guitars", "Bass Drums", "Bass Guitars", "Bongo Drums", "Cellos"] }),
        f("condition", "Condition", "multi_select", { options: CONDITION_SIMPLE })
      ]},
      { name: "Books & Table Games", fields: [
        f("type", "Type", "select", { required: true, options: ["Board Games", "Books"] }),
        f("ageLevel", "Age Level", "multi_select", { options: ["Adult", "Baby", "Children"] }),
        f("condition", "Condition", "multi_select", { required: true, options: CONDITION_SIMPLE })
      ]},
      { name: "Arts, Crafts & Awards", fields: [
        f("type", "Type", "select", { options: ["Yarn", "Wood Burning Tools", "Stuff for Presents", "Sewing Threads", "Sculptures", "Pictures"] })
      ]},
      { name: "Outdoor Gear", fields: [
        f("brand", "Brand", "multi_select", { required: true }),
        f("type", "Type", "select", { required: true, options: ["Binoculars", "Camping Mat", "Compasses", "Cooking Supplies", "Furniture", "Lanterns & Headlamps"] }),
        f("condition", "Condition", "multi_select", { required: true, options: CONDITION_SIMPLE }),
        f("color", "Color", "multi_select")
      ]},
      { name: "Smoking Accessories", fields: [
        f("brand", "Brand", "multi_select"),
        f("type", "Type", "select", { required: true, options: ["Ashtrays", "Bongs", "Chewing Tobacco", "Cigarettes", "Cigars", "E-Liquids"] }),
        f("condition", "Condition", "select", { options: CONDITION_SIMPLE })
      ]},
      { name: "Music & Video", fields: [
        f("type", "Type", "select", { required: true, options: ["Audiobooks", "Blank CDs & DVDs", "Movies", "Music", "Training", "Tutorial"] }),
        f("condition", "Condition", "multi_select", { required: true, options: CONDITION_SIMPLE })
      ]}
    ]
  },

  // ---------------------------------------------------------------- 11. Babies & Kids
  {
    name: "Babies & Kids",
    children: [
      { name: "Toys & Games", fields: [
        f("brand", "Brand", "multi_select", { required: true }),
        f("type", "Type", "select", { required: true, options: ["Action Figures", "Arts & Crafts", "Baby & Toddler Toys", "Balloons", "Balls", "Basketball Hoops"] }),
        f("gender", "Gender", "multi_select", { required: true, options: ["Girls", "Boys", "Unisex"] }),
        f("age", "Age", "multi_select"),
        f("color", "Color", "multi_select"),
        f("condition", "Condition", "select", { options: CONDITION_SIMPLE })
      ]},
      { name: "Children's Furniture", fields: [
        f("brand", "Brand", "multi_select"),
        f("type", "Type", "select", { required: true, options: ["Bed Canopies", "Beds", "Chairs", "Changing Tables", "Desks", "Dressers & Drawers"] }),
        f("color", "Color", "multi_select"),
        f("condition", "Condition", "select", { options: CONDITION_SIMPLE })
      ]},
      { name: "Baby Gear & Equipment", fields: [
        f("type", "Type", "select", { required: true, options: ["Bouncers & Swings", "Feeding Chair", "Mosquito Nets", "Playpens", "Skating & Bicycle Gear", "Swimming Gear"] }),
        f("condition", "Condition", "select", { required: true, options: CONDITION_SIMPLE }),
        f("gender", "Gender", "multi_select", { options: ["Girls", "Boys", "Unisex"] }),
        f("age", "Age", "multi_select"),
        f("color", "Color", "multi_select")
      ]},
      { name: "Care & Feeding", fields: [
        f("brand", "Brand", "multi_select"),
        f("type", "Type", "select", { required: true, options: ["Baby Bed Rails", "Baby Bed Sheets", "Baby Gift Sets", "Baby Grooming Kits", "Baby Hearing Protection", "Baby Manicure Sets"] }),
        f("condition", "Condition", "multi_select", { options: CONDITION_SIMPLE })
      ]},
      { name: "Maternity & Pregnancy", fields: [
        f("type", "Type", "select", { required: true, options: ["Breast Pads", "Breast Pumps", "Breastmilk Storage Bags", "Disposable Pants", "Dresses", "Fetal Doppler"] }),
        f("condition", "Condition", "multi_select", { required: true, options: CONDITION_SIMPLE })
      ]},
      { name: "Transport & Safety", fields: [
        f("brand", "Brand", "multi_select", { required: true }),
        f("type", "Type", "select", { options: ["Baby Monitors", "Car Seats", "Carriers", "Prams & Strollers", "Other"] }),
        f("color", "Color", "multi_select", { required: true }),
        f("condition", "Condition", "multi_select", { options: CONDITION_SIMPLE })
      ]},
      { name: "Playground Equipment", fields: [
        f("brand", "Brand", "multi_select", { required: true }),
        f("type", "Type", "select", { required: true, options: ["Balance Beams", "Basketball Hoops", "Challengers", "Free Spinning", "Free Standing Houses", "Gyms"] }),
        f("gender", "Gender", "multi_select", { required: true, options: ["Girls", "Boys", "Unisex"] }),
        f("age", "Age", "multi_select"),
        f("color", "Color", "multi_select"),
        f("condition", "Condition", "select", { options: CONDITION_SIMPLE })
      ]}
    ]
  },

  // ---------------------------------------------------------------- 12. Food, Agriculture & Farming
  {
    name: "Food, Agriculture & Farming",
    children: [
      { name: "Food & Beverages", fields: [
        f("brand", "Brand", "multi_select"),
        f("type", "Type", "select", { required: true, options: ["Alcoholic Drinks", "Bakery Products", "Cereals and Flakes", "Cheese", "Coffee", "Coffee Beans"] })
      ]},
      { name: "Farm Animals", fields: [
        f("type", "Type", "select", { required: true, options: ["Chickens", "Chinchillas", "Cows", "Ducks", "Fish", "Geese"] })
      ]},
      { name: "Seeds & Fertilizers", fields: [
        f("type", "Type", "select", { options: ["Fertilizers", "Flower Seeds", "Fruit Seeds", "Herb Seeds", "Perennial Seeds", "Vegetables Seeds"] }),
        f("brand", "Brand", "select")
      ]},
      { name: "Farm Machinery & Equipment", fields: [
        f("type", "Type", "select", { required: true, options: ["Cages", "Cassava Processing Machines", "Chicken Processing Equipment", "Cow Milking Machines", "Drinkers", "Egg Incubators"] }),
        f("color", "Color", "multi_select"),
        f("condition", "Condition", "multi_select", { required: true, options: CONDITION_SIMPLE })
      ]},
      { name: "Farm Animal Feed & Supplements", fields: [
        f("type", "Type", "multi_select", { options: ["Complete Mixed Feeds", "Forage", "Grains & Seeds", "Minerals & Supplements", "Protein Feeds"] }),
        f("animalType", "Animal Type", "multi_select", { options: ["Cattle", "Parrots", "Pigs", "Poultry", "Other"] })
      ]}
    ]
  },

  // ---------------------------------------------------------------- 13. Animals & Pets
  {
    name: "Animals & Pets",
    children: [
      { name: "Pet's Accessories", fields: [
        f("type", "Type", "select", { required: true, options: ["Accessories", "Cages", "Dogs & Cats Food", "Dogs & Cats Houses", "Fish Feed", "Grooming"] }),
        f("condition", "Condition", "multi_select", { required: true, options: CONDITION_SIMPLE })
      ]},
      { name: "Cats & Kittens", fields: [
        f("gender", "Gender", "multi_select", { required: true, options: ["Male", "Female"] }),
        f("breed", "Breed", "select", { required: true }),
        f("breedType", "Breed Type", "multi_select", { options: ["Mixed Breed", "Purebred"] }),
        f("age", "Age", "multi_select")
      ]},
      { name: "Dogs & Puppies", fields: [
        f("gender", "Gender", "multi_select", { required: true, options: ["Male", "Female"] }),
        f("breed", "Breed", "multi_select", { required: true }),
        f("breedType", "Breed Type", "multi_select", { options: ["Mixed Breed", "Purebred"] }),
        f("age", "Age", "multi_select")
      ]},
      { name: "Fish", fields: [
        f("type", "Type", "select", { required: true, options: ["Air Blower", "Aquariums", "Filters for aquariums", "Fish", "Food", "Other"] })
      ]},
      { name: "Birds", fields: [
        f("gender", "Gender", "multi_select", { required: true, options: ["Male", "Female"] }),
        f("age", "Age", "multi_select"),
        f("type", "Type", "select", { required: true, options: ["Canary", "Owl", "Parrot", "Peacock", "Pigeon", "Other"] })
      ]},
      { name: "Other Animals", fields: [] }
    ]
  },

  // ---------------------------------------------------------------- 14. Business & Industry
  {
    name: "Business & Industry",
    children: [
      {
        name: "Business for Sale & Investment",
        children: [
          "Franchise & Dealership",
          "Running Business for Sale",
          "Investor/Partner Wanted"
        ].map((name) => ({
          name,
          fields: [
            f("askingPriceBasis", "Asking Price Basis", "select", { options: ["Asset Sale", "Equity Sale"] }),
            f("annualRevenue", "Annual Revenue", "number"),
            f("reasonForSelling", "Reason for Selling", "text"),
            f("yearsEstablished", "Years Established", "number")
          ]
        }))
      },
      { name: "Wholesale & Bulk", fields: [] }
    ]
  }
];

const upsertNode = async (node, parentId) => {
  const existing = await prisma.productCategory.findFirst({ where: { parentId: parentId ?? null, name: node.name } });
  const data = {
    name: node.name,
    parentId: parentId ?? null,
    listingFields: node.fields ?? [],
    isActive: true,
    moderationStatus: "approved"
  };
  const saved = existing
    ? await prisma.productCategory.update({ where: { id: existing.id }, data })
    : await prisma.productCategory.create({ data });

  let childCount = 1;
  for (const child of node.children ?? []) {
    childCount += await upsertNode(child, saved.id);
  }
  return childCount;
};

const run = async () => {
  let total = 0;
  for (const topLevel of TREE) {
    total += await upsertNode(topLevel, null);
  }
  process.stdout.write(`Seeded/updated ${total} product categories across ${TREE.length} top-level trees.\n`);
  await prisma.$disconnect();
};

run().catch(async (err) => {
  process.stderr.write(`${err.stack || err}\n`);
  await prisma.$disconnect();
  process.exit(1);
});
