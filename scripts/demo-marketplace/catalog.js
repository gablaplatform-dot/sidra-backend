// Demo providers + listings for presenting the Jiji-style browse page. Every record is tagged by the
// DEMO_EMAIL_DOMAIN of its owner user, so `node scripts/seed-demo-marketplace.js --clear` removes
// all of it (providers, listings and ads) in one go.
export const DEMO_EMAIL_DOMAIN = "seed.gabla.test";

// ProductCategory paths (matched by name, so the script works against any database regardless of ids).
export const CAT = {
  LAPTOP: "Electronics > Laptops & Computers",
  MONITOR: "Electronics > Computer Monitors",
  ACCESSORY: "Electronics > Computer Accessories",
  PRINTER: "Electronics > Printers & Scanners",
  TV: "Electronics > TV & Video Equipment",
  CONSOLE: "Electronics > Video Game Consoles",
  AUDIO: "Electronics > Audio & Music Equipment",
  CAMERA: "Electronics > Photo & Video Cameras",
  PHONE: "Phones & Tablets > Mobile Phones",
  TABLET: "Phones & Tablets > Tablets",
  SMARTWATCH: "Phones & Tablets > Smart Watches",
  HEADPHONES: "Phones & Tablets > Headphones",
  CAR: "Vehicles > Cars",
  MOTORBIKE: "Vehicles > Motorcycles & Scooters",
  FURNITURE: "Home, Furniture & Appliances > Furniture",
  APPLIANCE: "Home, Furniture & Appliances > Home Appliances",
  KITCHEN: "Home, Furniture & Appliances > Kitchen Appliances",
  COOKWARE: "Home, Furniture & Appliances > Kitchenware & Cookware",
  MEN_CLOTHES: "Fashion > Men's Fashion > Men's Clothing",
  MEN_SHOES: "Fashion > Men's Fashion > Men's Shoes",
  MEN_WATCH: "Fashion > Men's Fashion > Men's Watches",
  WOMEN_CLOTHES: "Fashion > Women's Fashion > Women's Clothing",
  WOMEN_SHOES: "Fashion > Women's Fashion > Women's Shoes",
  WOMEN_BAGS: "Fashion > Women's Fashion > Women's Bags"
};

// row = [category, name, priceUGX, imagePool, customFields, { was, desc, sold, views }]
const NEW = ["Brand New"];
const USED = ["Used"];
const REFURB = ["Refurbished"];

export const PROVIDERS = [
  {
    key: "techhub",
    businessName: "TechHub Kampala",
    description: "Laptops, monitors and office tech with a 3-month warranty. Walk in at Kampala Road or order for delivery within the hour.",
    district: "Kampala", area: "Kampala Central", lat: 0.3136, lng: 32.5811, phone: "+256700100101", avatar: "laptop",
    products: [
      [CAT.LAPTOP, "Apple MacBook Air 13\" M2 8GB 256GB", 3650000, "laptop", { type: "Laptop", brand: "Apple", condition: NEW, ram: ["8GB"], storageCapacity: ["256GB"], displaySize: ['13"/13.3"'], storageType: ["SSD"], operatingSystem: [], highlights: ["Thin and Light", "Long Battery Life"] }, { was: 3990000, desc: "Sealed MacBook Air with Apple warranty. Midnight colour, UK keyboard." }],
      [CAT.LAPTOP, "HP EliteBook 840 G5 Core i7 16GB 512GB SSD", 1450000, "laptop", { type: "Laptop", brand: "HP", condition: REFURB, ram: ["16GB"], processor: ["Intel Core"], storageCapacity: ["512GB"], displaySize: ['13"/13.3"'], storageType: ["SSD"], operatingSystem: ["Windows 11"], highlights: ["For The Office", "Thin and Light"] }, { desc: "Ex-corporate EliteBook, Grade A, battery health 90%+. Backlit keyboard and fingerprint reader." }],
      [CAT.LAPTOP, "Dell Latitude 7490 Core i5 8GB 256GB SSD", 980000, "laptop", { type: "Laptop", brand: "Dell", condition: REFURB, ram: ["8GB"], processor: ["Intel Core"], storageCapacity: ["256GB"], displaySize: ['13"/13.3"'], storageType: ["SSD"], operatingSystem: ["Windows 10"], highlights: ["For The Office"] }, { desc: "Light and fast, ideal for students and accounting work." }],
      [CAT.LAPTOP, "Lenovo ThinkPad T480 Core i5 8GB 500GB HDD", 720000, "laptop", { type: "Laptop", brand: "Lenovo", condition: USED, ram: ["8GB"], processor: ["Intel Core"], storageCapacity: ["512GB"], displaySize: ['13"/13.3"'], storageType: ["HDD"], operatingSystem: ["Windows 10"], highlights: ["For The Office", "Long Battery Life"] }, { desc: "Dual battery ThinkPad, runs 10+ hours. Minor cosmetic wear." }],
      [CAT.LAPTOP, "Acer Nitro 5 Gaming Core i5 16GB RTX 3050", 3200000, "laptop", { type: "Laptop", brand: "Acer", condition: NEW, ram: ["16GB"], processor: ["Intel Core"], storageCapacity: ["512GB"], displaySize: ['15"/15.6"'], storageType: ["SSD"], operatingSystem: ["Windows 11"], highlights: ["For Gaming"] }, { was: 3500000, desc: "144Hz display, RTX 3050 graphics. Plays all current titles at high settings." }],
      [CAT.LAPTOP, "HP ProBook 450 G7 Core i5 8GB 1TB", 1150000, "laptop", { type: "Laptop", brand: "HP", condition: REFURB, ram: ["8GB"], processor: ["Intel Core"], storageCapacity: ["1T"], displaySize: ['15"/15.6"'], storageType: ["HDD"], operatingSystem: ["Windows 11"], highlights: ["For The Office"] }, {}],
      [CAT.MONITOR, "Dell 24\" Full HD IPS Monitor", 420000, "monitor", { brand: "Dell", resolution: ["Full HD"], screenSize: 24, condition: NEW, displayTechnology: ["IPS"] }, { desc: "Slim-bezel IPS panel with HDMI and VGA inputs." }],
      [CAT.MONITOR, "Samsung 27\" Curved Monitor 75Hz", 590000, "monitor", { brand: "Samsung", resolution: ["Full HD"], screenSize: 27, condition: NEW }, { was: 650000 }],
      [CAT.ACCESSORY, "Logitech Wireless Keyboard and Mouse Combo", 95000, "keyboard", { brand: ["Logitech"], type: "Keyboards", condition: NEW }, { desc: "Quiet keys, 2.4GHz receiver, 18-month battery life." }],
      [CAT.ACCESSORY, "Mechanical Gaming Keyboard RGB Backlit", 160000, "keyboard", { brand: ["Redragon"], type: "Keyboards", condition: NEW }, { was: 190000 }],
      [CAT.PRINTER, "HP LaserJet Pro M404dn Monochrome Printer", 1350000, "printer", { type: "Laser Printer", brand: ["HP"], condition: NEW }, { desc: "Fast duplex printing for busy offices, 38 pages per minute." }],
      [CAT.PRINTER, "Canon PIXMA All-in-One Colour Printer", 520000, "printer", { type: "Ink-Jet Printer", brand: ["Canon"], condition: NEW }, {}],
      [CAT.HEADPHONES, "Sony WH-1000XM4 Noise Cancelling Headphones", 980000, "headphones", { brand: "Sony", type: ["Over-Ear"], connectivity: ["Wireless"], color: ["Black"], condition: NEW, features: ["Active Noise Cancellation"], highlights: ["Studio"] }, { was: 1150000 }],
      [CAT.CAMERA, "Canon EOS 2000D DSLR with 18-55mm Lens", 1750000, "camera", { type: "DSLR", make: ["Canon"], condition: NEW }, { desc: "24MP beginner DSLR with bag and 32GB card." }]
    ]
  },
  {
    key: "gadget",
    businessName: "Gadget Galaxy Ug",
    description: "Authentic phones, tablets, earbuds and gaming consoles at Ntinda. Trade-ins welcome, exchange possible on most phones.",
    district: "Kampala", area: "Nakawa", lat: 0.3350, lng: 32.6150, phone: "+256700100102", avatar: "phone",
    products: [
      [CAT.PHONE, "iPhone 14 Pro Max 256GB Deep Purple", 4300000, "phone", { brand: "Apple", condition: ["Used"], internalStorage: ["256 GB"], ram: ["6 GB"], color: ["Gray"], classType: ["Smartphones"], numberOfSims: ["eSIM Only"], displayTechnology: ["OLED"], displaySize: ['6.6-6.8"'], highlights: ["5G", "NFC"], exchangePossible: true }, { desc: "Clean UK-used, battery health 91%. Comes boxed with cable." }],
      [CAT.PHONE, "iPhone 13 128GB Midnight", 2350000, "phone", { brand: "Apple", condition: ["Refurbished"], internalStorage: ["128 GB"], ram: ["4 GB"], color: ["Black"], classType: ["Smartphones"], numberOfSims: ["Dual SIM"], displayTechnology: ["OLED"], displaySize: ['6.1-6.5"'], highlights: ["5G"], exchangePossible: true }, { was: 2600000 }],
      [CAT.PHONE, "Samsung Galaxy S23 Ultra 512GB", 4100000, "phone", { brand: "Samsung", condition: NEW, internalStorage: ["512 GB"], ram: ["8 GB"], color: ["Black"], classType: ["Smartphones"], numberOfSims: ["Dual SIM"], displayTechnology: ["AMOLED"], displaySize: ['6.6-6.8"'], highlights: ["5G", "NFC", "AMOLED"], exchangePossible: false }, { was: 4500000, desc: "Sealed with 1 year warranty. S-Pen included." }],
      [CAT.PHONE, "Samsung Galaxy A54 5G 128GB", 1450000, "phone", { brand: "Samsung", condition: NEW, internalStorage: ["128 GB"], ram: ["8 GB"], color: ["Blue"], classType: ["Smartphones"], numberOfSims: ["Dual SIM"], displayTechnology: ["AMOLED"], displaySize: ['6.1-6.5"'], highlights: ["5G", "AMOLED", "Dual SIM"], exchangePossible: true }, {}],
      [CAT.PHONE, "Tecno Spark 20 Pro 256GB", 620000, "phone", { brand: "Tecno", condition: NEW, internalStorage: ["256 GB"], ram: ["8 GB"], color: ["Black"], classType: ["Smartphones"], numberOfSims: ["Dual SIM"], displayTechnology: ["IPS"], displaySize: ['6.6-6.8"'], highlights: ["Dual SIM", "5000 mAh+"], exchangePossible: true }, { desc: "120Hz display and 5000mAh battery. Official warranty." }],
      [CAT.PHONE, "Infinix Hot 40 Pro 128GB", 540000, "phone", { brand: "Infinix", condition: NEW, internalStorage: ["128 GB"], ram: ["8 GB"], color: ["Gold"], classType: ["Smartphones"], numberOfSims: ["Dual SIM"], displayTechnology: ["IPS"], displaySize: ['6.6-6.8"'], highlights: ["Dual SIM", "5000 mAh+"], exchangePossible: true }, {}],
      [CAT.PHONE, "Xiaomi Redmi Note 12 128GB", 780000, "phone", { brand: "Xiaomi", condition: NEW, internalStorage: ["128 GB"], ram: ["6 GB"], color: ["Gray"], classType: ["Smartphones"], numberOfSims: ["Dual SIM"], displayTechnology: ["AMOLED"], displaySize: ['6.6-6.8"'], highlights: ["AMOLED", "NFC"], exchangePossible: false }, { was: 850000 }],
      [CAT.TABLET, "Apple iPad 9th Gen 64GB WiFi", 1450000, "tablet", { brand: "Apple", condition: NEW, screenSize: ['9-10.9"'], color: ["Gray"], storageCapacity: ["64 GB"], operatingSystem: ["iOS"], ram: ["3 GB"], exchangePossible: true }, {}],
      [CAT.TABLET, "Samsung Galaxy Tab A8 32GB", 690000, "tablet", { brand: "Samsung", condition: NEW, screenSize: ['9-10.9"'], color: ["Gray"], storageCapacity: ["32 GB"], operatingSystem: ["Android"] }, { desc: "Great for school and streaming. Wi-Fi model." }],
      [CAT.SMARTWATCH, "Apple Watch Series 8 GPS 45mm", 1650000, "smartwatch", { brand: "Apple", type: "Smart Watches", bandColor: ["Black"], condition: REFURB }, { was: 1850000 }],
      [CAT.SMARTWATCH, "Samsung Galaxy Watch 5 44mm", 890000, "smartwatch", { brand: "Samsung", type: "Smart Watches", bandColor: ["Black"], condition: NEW }, {}],
      [CAT.HEADPHONES, "Apple AirPods Pro 2nd Generation", 720000, "earbuds", { brand: "Apple", type: ["In-Ear"], connectivity: ["Wireless"], color: ["White"], condition: NEW, features: ["Active Noise Cancellation"], highlights: ["True Wireless"] }, { desc: "USB-C case, sealed with Apple warranty." }],
      [CAT.HEADPHONES, "JBL Tune 760NC Wireless Headphones", 340000, "headphones", { brand: "JBL", type: ["Over-Ear"], connectivity: ["Wireless"], color: ["Blue"], condition: NEW, features: ["Active Noise Cancellation"] }, { was: 390000 }],
      [CAT.CONSOLE, "Sony PlayStation 5 Slim Disc Edition", 2650000, "console", { brand: ["Sony"], type: "Game Consoles", condition: NEW, exchangePossible: false }, { desc: "Disc edition with one DualSense controller and HDMI cable." }],
      [CAT.CONSOLE, "PlayStation 4 Slim 500GB with 2 Pads", 980000, "console", { brand: ["Sony"], type: "Game Consoles", condition: USED, exchangePossible: true }, { desc: "Fully working, includes 2 controllers and FIFA 24." }]
    ]
  },
  {
    key: "urban",
    businessName: "Urban Threads Boutique",
    description: "Streetwear, office wear and shoes picked fresh from Dubai and Nairobi every fortnight. Makindye showroom, delivery countrywide.",
    district: "Kampala", area: "Makindye", lat: 0.2750, lng: 32.5900, phone: "+256700100103", avatar: "handbag",
    products: [
      [CAT.MEN_CLOTHES, "Slim Fit Navy Two-Piece Suit", 450000, "suit", { type: "Suits", brand: ["Zara"], color: ["Blue"], style: ["Formal"], condition: NEW, size: ["M"], material: ["Wool"] }, { was: 520000, desc: "Tailored two-piece in breathable wool blend. Free trouser hemming." }],
      [CAT.MEN_CLOTHES, "Charcoal Business Suit Single Breasted", 480000, "suit", { type: "Suits", brand: ["Hugo Boss"], color: ["Gray"], style: ["Formal"], condition: NEW, size: ["L+"], material: ["Wool"] }, {}],
      [CAT.MEN_CLOTHES, "Men's Oxford Button-Down Shirt Light Blue", 65000, "shirt", { type: "Shirts", brand: ["Tommy Hilfiger"], color: ["Blue"], style: ["Casual"], condition: NEW, size: ["M"], material: ["Cotton"] }, {}],
      [CAT.MEN_CLOTHES, "Men's Checked Dress Shirt", 55000, "shirt", { type: "Shirts", brand: ["Zara"], color: ["Black"], style: ["Classic"], condition: NEW, size: ["L+"] }, { was: 70000 }],
      [CAT.MEN_CLOTHES, "Oversized Heavyweight Hoodie Grey", 85000, "hoodie", { type: "Hoodies", brand: ["Nike"], color: ["Gray"], style: ["Casual"], condition: NEW, size: ["L+"], material: ["Cotton"] }, { desc: "Fleece-lined, 400gsm. Unisex fit." }],
      [CAT.MEN_CLOTHES, "Plain Crew Neck T-Shirt 3-Pack", 60000, "tshirt", { type: "T-Shirts", brand: ["H&M"], color: ["White"], style: ["Casual"], condition: NEW, size: ["M"], material: ["Cotton"] }, {}],
      [CAT.MEN_CLOTHES, "Slim Straight Denim Jeans Washed Blue", 90000, "jeans", { type: "Jeans", brand: ["Levi's"], color: ["Blue"], style: ["Casual"], condition: NEW, size: ["M"], material: ["Denim"] }, { was: 110000 }],
      [CAT.MEN_SHOES, "Nike Air Force 1 Low White", 320000, "sneakers", { type: "Sneakers", gender: ["Men's"], brand: ["Nike"], condition: NEW, size: ["42+"], color: ["White"] }, { desc: "Authentic, comes boxed. Sizes 40 to 45 in stock." }],
      [CAT.MEN_SHOES, "Adidas Samba OG Black White", 295000, "sneakers", { type: "Sneakers", gender: ["Men's"], brand: ["Adidas"], condition: NEW, size: ["41"], color: ["Black"] }, {}],
      [CAT.MEN_SHOES, "Leather Oxford Dress Shoes Brown", 210000, "shoes", { type: "Oxfords", gender: ["Men's"], brand: ["Clarks"], condition: NEW, size: ["42+"], color: ["Brown"] }, { was: 250000 }],
      [CAT.WOMEN_CLOTHES, "Floral Midi Summer Dress", 78000, "dress", { type: "Dresses", brand: ["Zara"], color: ["Blue"], style: ["Casual"], condition: NEW, size: ["M"], material: ["Cotton"] }, { desc: "Lightweight, perfect for weekends and weddings." }],
      [CAT.WOMEN_CLOTHES, "Beige Lace Evening Dress", 160000, "dress", { type: "Dresses", brand: ["Shein"], color: ["Beige"], style: ["Classic"], condition: NEW, size: ["S"] }, { was: 190000 }],
      [CAT.WOMEN_SHOES, "Block Heel Sandals Nude", 120000, "heels", { type: "Heels", gender: ["Women's"], brand: ["Aldo"], condition: NEW, size: ["40"], color: ["Beige"] }, {}],
      [CAT.WOMEN_BAGS, "Structured Leather Handbag Tan", 240000, "handbag", { gender: ["Women's"], brand: ["Michael Kors"], type: "Handbags", color: ["Brown"], condition: NEW }, { was: 290000, desc: "Gold hardware, detachable strap, two inner pockets." }]
    ]
  },
  {
    key: "bulenga",
    businessName: "Bulenga Home & Living",
    description: "Locally made and imported furniture plus home appliances. Free delivery within Wakiso and Kampala on orders above UGX 500,000.",
    district: "Wakiso", area: "Bulenga", lat: 0.3105, lng: 32.5300, phone: "+256700100104", avatar: "sofa",
    products: [
      [CAT.FURNITURE, "L-Shaped Fabric Sectional Sofa Grey", 2400000, "sofa", { type: "Sofas", condition: NEW, room: ["Living Room"], material: ["Fabric"], color: ["Gray"], bulkPriceAvailable: false }, { was: 2800000, desc: "Seats 6 comfortably. Solid mahogany frame, 5-year frame guarantee." }],
      [CAT.FURNITURE, "3-Seater Leather Sofa Brown", 1850000, "sofa", { type: "Sofas", condition: NEW, room: ["Living Room"], material: ["Leather"], color: ["Brown"] }, {}],
      [CAT.FURNITURE, "Modern Green Velvet Sofa", 1650000, "sofa", { type: "Sofas", condition: NEW, room: ["Living Room"], material: ["Fabric"], color: ["Green"] }, { desc: "Gold metal legs, deep-seat cushions." }],
      [CAT.FURNITURE, "Accent Armchair Mustard Fabric", 520000, "armchair", { type: "Armchairs", condition: NEW, room: ["Living Room"], color: ["Brown"] }, {}],
      [CAT.FURNITURE, "Solid Wood Armchair with Cushion", 480000, "armchair", { type: "Armchairs", condition: NEW, room: ["Living Room", "Bedroom"], material: ["Wood"], color: ["Brown"] }, { was: 560000 }],
      [CAT.FURNITURE, "6-Seater Wooden Dining Table Set", 1950000, "dining", { type: "Dining Tables", condition: NEW, room: ["Dining Room"], material: ["Wood"], color: ["Brown"] }, { desc: "Table plus six upholstered chairs, polished finish." }],
      [CAT.FURNITURE, "4-Seater Dining Set Black Top", 1100000, "dining", { type: "Dining Tables", condition: NEW, room: ["Dining Room"], material: ["Wood"], color: ["Black"] }, { was: 1300000 }],
      [CAT.FURNITURE, "King Size Upholstered Bed Frame", 1750000, "bed", { type: "Beds & Bed Frames", condition: NEW, room: ["Bedroom"], material: ["Wood"], color: ["Gray"] }, { desc: "Tufted headboard. Mattress sold separately." }],
      [CAT.FURNITURE, "Queen Wooden Bed with Storage", 1250000, "bed", { type: "Beds & Bed Frames", condition: NEW, room: ["Bedroom"], material: ["Wood"], color: ["Brown"] }, {}],
      [CAT.FURNITURE, "Ergonomic Office Chair High Back", 380000, "officeChair", { type: "Office Chairs", condition: NEW, room: ["Home Office"], material: ["Mesh"], color: ["Black"] }, { was: 450000 }],
      [CAT.FURNITURE, "Open Bookshelf 5-Tier Walnut", 420000, "storage", { type: "Bookcases", condition: NEW, room: ["Living Room"], material: ["Wood"], color: ["Brown"] }, {}],
      [CAT.APPLIANCE, "LG Front-Load Washing Machine 8kg", 1650000, "washer", { type: "Washing Machines", brand: ["LG"], condition: NEW }, { desc: "Inverter direct-drive, 10-year motor warranty." }],
      [CAT.APPLIANCE, "Hisense Double-Door Fridge 300L", 1450000, "fridge", { type: "Refrigerators", brand: ["Hisense"], condition: NEW }, { was: 1650000 }],
      [CAT.APPLIANCE, "Von Hot Standing Fan 18 inch", 135000, "fan", { type: "Fans", brand: ["Von Hot"], condition: NEW }, {}]
    ]
  },
  {
    key: "lakeside",
    businessName: "Lakeside Motors Entebbe",
    description: "Hand-picked Japanese imports and locally used cars with clean logbooks. Test drives by appointment at Entebbe Road.",
    district: "Wakiso", area: "Entebbe", lat: 0.0512, lng: 32.4637, phone: "+256700100105", avatar: "suv",
    products: [
      [CAT.CAR, "Toyota Land Cruiser Prado TX 2016", 138000000, "suv", { make: "Toyota", yearOfManufacture: 2016, condition: ["Foreign Used"], drivetrain: ["4WD"], transmission: ["Automatic"], mileage: 82000, registeredCar: true, body: ["SUV"], color: ["Black"], engineSize: 2700, fuel: ["Petrol"] }, { desc: "7 seater, sunroof, leather interior. Single owner in Japan." }],
      [CAT.CAR, "Toyota RAV4 Hybrid 2017", 78000000, "suv", { make: "Toyota", yearOfManufacture: 2017, condition: ["Foreign Used"], drivetrain: ["AWD"], transmission: ["Automatic"], mileage: 61000, registeredCar: true, body: ["SUV"], color: ["Beige"], engineSize: 2500, fuel: ["Petrol"], powertrainType: ["Hybrid"] }, {}],
      [CAT.CAR, "Toyota Harrier 2014 Premium", 58000000, "suv", { make: "Toyota", yearOfManufacture: 2014, condition: ["Foreign Used"], drivetrain: ["Front Wheel"], transmission: ["Automatic"], mileage: 96000, registeredCar: true, body: ["SUV"], color: ["Black"], engineSize: 2000, fuel: ["Petrol"] }, { was: 62000000 }],
      [CAT.CAR, "Subaru Forester XT 2015", 52000000, "suv", { make: "Subaru", yearOfManufacture: 2015, condition: ["Foreign Used"], drivetrain: ["AWD"], transmission: ["Automatic"], mileage: 88000, registeredCar: true, body: ["SUV"], color: ["Gray"], engineSize: 2000, fuel: ["Petrol"] }, {}],
      [CAT.CAR, "Nissan X-Trail 2013", 36000000, "suv", { make: "Nissan", yearOfManufacture: 2013, condition: ["Local Used"], drivetrain: ["4WD"], transmission: ["Automatic"], mileage: 118000, registeredCar: true, body: ["SUV"], color: ["Blue"], engineSize: 2000, fuel: ["Petrol"] }, { desc: "Well maintained locally, service history available." }],
      [CAT.CAR, "Mazda CX-5 2016", 48000000, "suv", { make: "Mazda", yearOfManufacture: 2016, condition: ["Foreign Used"], drivetrain: ["Front Wheel"], transmission: ["Automatic"], mileage: 70000, registeredCar: true, body: ["SUV"], color: ["Burgundy"], engineSize: 2200, fuel: ["Diesel"] }, { was: 51000000 }],
      [CAT.CAR, "Mercedes-Benz C200 2015", 62000000, "sedan", { make: "Mercedes-Benz", yearOfManufacture: 2015, condition: ["Foreign Used"], drivetrain: ["Rear Wheel"], transmission: ["Automatic"], mileage: 74000, registeredCar: true, body: ["Sedan"], color: ["Black"], engineSize: 2000, fuel: ["Petrol"] }, {}],
      [CAT.CAR, "Toyota Premio 2012 1.8L", 28500000, "sedan", { make: "Toyota", yearOfManufacture: 2012, condition: ["Local Used"], drivetrain: ["Front Wheel"], transmission: ["Automatic"], mileage: 132000, registeredCar: true, body: ["Sedan"], color: ["Beige"], engineSize: 1800, fuel: ["Petrol"] }, { desc: "Cheap to run and spare parts everywhere. Ideal first car." }],
      [CAT.CAR, "Toyota Allion A15 2011", 26000000, "sedan", { make: "Toyota", yearOfManufacture: 2011, condition: ["Local Used"], drivetrain: ["Front Wheel"], transmission: ["Automatic"], mileage: 140000, registeredCar: true, body: ["Sedan"], color: ["Gray"], engineSize: 1500, fuel: ["Petrol"] }, {}],
      [CAT.CAR, "Subaru Legacy B4 2012", 31000000, "sedan", { make: "Subaru", yearOfManufacture: 2012, condition: ["Foreign Used"], drivetrain: ["AWD"], transmission: ["Automatic"], mileage: 99000, registeredCar: true, body: ["Sedan"], color: ["Blue"], engineSize: 2500, fuel: ["Petrol"] }, {}],
      [CAT.CAR, "Toyota Hilux Double Cabin 2018", 98000000, "pickup", { make: "Toyota", yearOfManufacture: 2018, condition: ["Foreign Used"], drivetrain: ["4WD"], transmission: ["Manual"], mileage: 64000, registeredCar: true, body: ["Pickup"], color: ["Gray"], engineSize: 2800, fuel: ["Diesel"] }, { desc: "Strong diesel work horse, canopy included." }],
      [CAT.CAR, "Mitsubishi Pajero Sport 2017", 82000000, "pickup", { make: "Mitsubishi", yearOfManufacture: 2017, condition: ["Foreign Used"], drivetrain: ["4WD"], transmission: ["Automatic"], mileage: 71000, registeredCar: true, body: ["SUV"], color: ["Black"], engineSize: 2400, fuel: ["Diesel"] }, {}],
      [CAT.CAR, "Toyota Noah 2014 8-Seater", 33000000, "suv", { make: "Toyota", yearOfManufacture: 2014, condition: ["Foreign Used"], drivetrain: ["Front Wheel"], transmission: ["Automatic"], mileage: 105000, registeredCar: true, body: ["Minivan"], color: ["Beige"], engineSize: 2000, fuel: ["Petrol"] }, { was: 35500000 }]
    ]
  },
  {
    key: "mukonoauto",
    businessName: "Mukono Auto Hub",
    description: "Family cars, workhorses and motorbikes on the Kampala-Jinja highway. Financing introductions available.",
    district: "Mukono", area: "Mukono Town", lat: 0.3533, lng: 32.7553, phone: "+256700100106", avatar: "pickup",
    products: [
      [CAT.CAR, "Toyota Fielder 2013 1.5L", 27500000, "suv", { make: "Toyota", yearOfManufacture: 2013, condition: ["Foreign Used"], drivetrain: ["Front Wheel"], transmission: ["Automatic"], mileage: 112000, registeredCar: true, body: ["Wagon"], color: ["Gray"], engineSize: 1500, fuel: ["Petrol"] }, {}],
      [CAT.CAR, "Toyota Wish 2012", 24500000, "suv", { make: "Toyota", yearOfManufacture: 2012, condition: ["Local Used"], drivetrain: ["Front Wheel"], transmission: ["Automatic"], mileage: 128000, registeredCar: true, body: ["Minivan"], color: ["Beige"], engineSize: 1800, fuel: ["Petrol"] }, { desc: "7 seater, perfect for family and school runs." }],
      [CAT.CAR, "Nissan Note 2014", 19800000, "sedan", { make: "Nissan", yearOfManufacture: 2014, condition: ["Foreign Used"], drivetrain: ["Front Wheel"], transmission: ["CVT"], mileage: 89000, registeredCar: true, body: ["Wagon"], color: ["Blue"], engineSize: 1200, fuel: ["Petrol"] }, {}],
      [CAT.CAR, "Mazda Demio 2013", 17500000, "sedan", { make: "Mazda", yearOfManufacture: 2013, condition: ["Foreign Used"], drivetrain: ["Front Wheel"], transmission: ["Automatic"], mileage: 95000, registeredCar: true, body: ["Wagon"], color: ["Burgundy"], engineSize: 1300, fuel: ["Petrol"] }, { was: 19000000 }],
      [CAT.CAR, "Toyota Hilux Revo Single Cabin 2019", 89000000, "pickup", { make: "Toyota", yearOfManufacture: 2019, condition: ["Foreign Used"], drivetrain: ["4WD"], transmission: ["Manual"], mileage: 54000, registeredCar: true, body: ["Pickup"], color: ["Gray"], engineSize: 2400, fuel: ["Diesel"] }, {}],
      [CAT.CAR, "Subaru Impreza G4 2014", 29500000, "sedan", { make: "Subaru", yearOfManufacture: 2014, condition: ["Foreign Used"], drivetrain: ["AWD"], transmission: ["CVT"], mileage: 91000, registeredCar: true, body: ["Sedan"], color: ["Blue"], engineSize: 1600, fuel: ["Petrol"] }, {}],
      [CAT.CAR, "Toyota Corolla Axio 2015", 32000000, "sedan", { make: "Toyota", yearOfManufacture: 2015, condition: ["Foreign Used"], drivetrain: ["Front Wheel"], transmission: ["Automatic"], mileage: 78000, registeredCar: true, body: ["Sedan"], color: ["Beige"], engineSize: 1500, fuel: ["Petrol"] }, { desc: "Economical hybrid-like fuel use, spotless interior." }],
      [CAT.CAR, "Mitsubishi Outlander 2014", 38000000, "suv", { make: "Mitsubishi", yearOfManufacture: 2014, condition: ["Foreign Used"], drivetrain: ["4WD"], transmission: ["Automatic"], mileage: 102000, registeredCar: true, body: ["SUV"], color: ["Black"], engineSize: 2400, fuel: ["Petrol"] }, {}],
      [CAT.MOTORBIKE, "Bajaj Boxer 150 Boda Boda 2023", 4200000, "motorcycle", { condition: ["Brand New"], yearOfManufacture: 2023, color: ["Black"] }, { desc: "Reliable commercial motorbike, first service free." }],
      [CAT.MOTORBIKE, "TVS HLX 150 2022", 3900000, "motorcycle", { condition: ["Brand New"], yearOfManufacture: 2022, color: ["Blue"] }, { was: 4100000 }],
      [CAT.MOTORBIKE, "Honda CB 125 Used 2019", 2800000, "motorcycle", { condition: ["Local Used"], yearOfManufacture: 2019, color: ["Black"] }, {}],
      [CAT.MOTORBIKE, "Yamaha YZF-R15 Sports Bike 2021", 12500000, "motorcycle", { condition: ["Local Used"], yearOfManufacture: 2021, color: ["Blue"] }, { desc: "Low mileage sport bike, accident free." }],
      [CAT.MOTORBIKE, "Suzuki Gixxer 150 2022", 7800000, "motorcycle", { condition: ["Brand New"], yearOfManufacture: 2022, color: ["Black"] }, {}]
    ]
  },
  {
    key: "nile",
    businessName: "Nile Fashion House",
    description: "Ready-to-wear fashion, shoes, bags and watches in Jinja. Same-day dispatch to Kampala.",
    district: "Jinja", area: "Jinja City", lat: 0.4244, lng: 33.2041, phone: "+256700100107", avatar: "dress",
    products: [
      [CAT.WOMEN_CLOTHES, "Ankara Print Maxi Dress", 95000, "dress", { type: "Dresses", brand: ["Zara"], color: ["Blue"], style: ["Casual"], condition: NEW, size: ["M"] }, { desc: "Made by local tailors with premium wax print." }],
      [CAT.WOMEN_CLOTHES, "Elegant Floral Wrap Dress", 120000, "dress", { type: "Dresses", brand: ["H&M"], color: ["Blue"], style: ["Classic"], condition: NEW, size: ["S"] }, { was: 145000 }],
      [CAT.WOMEN_CLOTHES, "Sleeveless Evening Gown Beige", 220000, "dress", { type: "Dresses", brand: ["Shein"], color: ["Beige"], style: ["Classic"], condition: NEW, size: ["L+"] }, {}],
      [CAT.WOMEN_CLOTHES, "Casual Midi Sundress", 70000, "dress", { type: "Dresses", brand: ["Zara"], color: ["Blue"], style: ["Casual"], condition: NEW, size: ["M"] }, {}],
      [CAT.MEN_CLOTHES, "Italian Cut Grey Suit", 520000, "suit", { type: "Suits", brand: ["Hugo Boss"], color: ["Gray"], style: ["Formal"], condition: NEW, size: ["L+"], material: ["Wool"] }, {}],
      [CAT.MEN_CLOTHES, "Blue Slim Fit Suit Jacket", 260000, "suit", { type: "Blazers", brand: ["Zara"], color: ["Blue"], style: ["Formal"], condition: NEW, size: ["M"] }, { was: 300000 }],
      [CAT.MEN_CLOTHES, "White Cotton Round Neck T-Shirt", 35000, "tshirt", { type: "T-Shirts", brand: ["Nike"], color: ["White"], style: ["Casual"], condition: NEW, size: ["M"], material: ["Cotton"] }, {}],
      [CAT.MEN_CLOTHES, "Pullover Hoodie Black", 80000, "hoodie", { type: "Hoodies", brand: ["Adidas"], color: ["Black"], style: ["Casual"], condition: NEW, size: ["L+"], material: ["Cotton"] }, {}],
      [CAT.WOMEN_SHOES, "Stiletto Pumps Classic Black", 135000, "heels", { type: "Heels", gender: ["Women's"], brand: ["Aldo"], condition: NEW, size: ["40"], color: ["Black"] }, {}],
      [CAT.WOMEN_SHOES, "Ankle Strap Heels Silver", 110000, "heels", { type: "Heels", gender: ["Women's"], brand: ["Aldo"], condition: NEW, size: ["40"], color: ["Gray"] }, { was: 130000 }],
      [CAT.MEN_SHOES, "Chelsea Leather Boots", 230000, "shoes", { type: "Boots", gender: ["Men's"], brand: ["Clarks"], condition: NEW, size: ["42+"], color: ["Brown"] }, {}],
      [CAT.MEN_SHOES, "Casual Leather Loafers", 150000, "shoes", { type: "Loafers", gender: ["Men's"], brand: ["Clarks"], condition: NEW, size: ["41"], color: ["Brown"] }, {}],
      [CAT.WOMEN_BAGS, "Crossbody Mini Bag Red", 85000, "handbag", { gender: ["Women's"], brand: ["Zara"], type: "Handbags", color: ["Red"], condition: NEW }, {}],
      [CAT.MEN_WATCH, "Classic Chronograph Watch Steel", 320000, "watch", { brand: "Fossil", gender: ["Men's"], movement: ["Quartz"], display: ["Analog"], bandColor: ["Silver"], condition: NEW }, { was: 380000 }]
    ]
  },
  {
    key: "ankole",
    businessName: "Ankole Electronics Mart",
    description: "Biggest TV and sound-system showroom in western Uganda. Installation and wall mounting included in Mbarara town.",
    district: "Mbarara", area: "Mbarara City", lat: -0.6072, lng: 30.6545, phone: "+256700100108", avatar: "tv",
    products: [
      [CAT.TV, "Samsung 55\" 4K UHD Smart TV", 2250000, "tv", { type: "TVs", brand: ["Samsung"], condition: NEW, exchangePossible: false }, { was: 2500000, desc: "Crystal 4K processor, Netflix and YouTube built in. 1 year warranty." }],
      [CAT.TV, "LG 43\" Full HD Smart TV", 1450000, "tv", { type: "TVs", brand: ["LG"], condition: NEW, exchangePossible: false }, {}],
      [CAT.TV, "Hisense 65\" QLED 4K Smart TV", 3450000, "tv", { type: "TVs", brand: ["Hisense"], condition: NEW }, { was: 3800000 }],
      [CAT.TV, "TCL 32\" HD LED TV", 620000, "tv", { type: "TVs", brand: ["TCL"], condition: NEW }, {}],
      [CAT.TV, "Sony Bravia 50\" 4K Android TV", 2850000, "tv", { type: "TVs", brand: ["Sony"], condition: NEW }, {}],
      [CAT.TV, "Syinix 40\" Smart TV", 890000, "tv", { type: "TVs", brand: ["Syinix"], condition: NEW }, { desc: "Great value smart TV with frameless design." }],
      [CAT.TV, "Used Samsung 43\" LED TV", 520000, "tv", { type: "TVs", brand: ["Samsung"], condition: USED }, { desc: "Clean UK-used, comes with remote and wall bracket." }],
      [CAT.AUDIO, "JBL Charge 5 Portable Bluetooth Speaker", 520000, "speaker", { type: "Portable Speakers", brand: ["JBL"], condition: NEW }, { was: 580000 }],
      [CAT.AUDIO, "Sony SRS-XB13 Mini Speaker", 190000, "speaker", { type: "Portable Speakers", brand: ["Sony"], condition: NEW }, {}],
      [CAT.AUDIO, "Bose SoundLink Flex Speaker", 680000, "speaker", { type: "Portable Speakers", brand: ["Bose"], condition: NEW }, {}],
      [CAT.AUDIO, "Home Theatre 5.1 Subwoofer System", 780000, "speaker", { type: "Home Theater Systems", brand: ["LG"], condition: NEW }, { desc: "Powerful bass, Bluetooth, USB and HDMI." }],
      [CAT.LAPTOP, "HP 255 G8 Ryzen 5 8GB 256GB", 1350000, "laptop", { type: "Laptop", brand: "HP", condition: NEW, ram: ["8GB"], storageCapacity: ["256GB"], displaySize: ['15"/15.6"'], storageType: ["SSD"], operatingSystem: ["Windows 11"], highlights: ["For The Office"] }, {}],
      [CAT.CONSOLE, "Xbox Series S 512GB", 1450000, "console", { brand: ["Microsoft"], type: "Game Consoles", condition: NEW }, {}],
      [CAT.CONSOLE, "Nintendo Switch OLED", 1750000, "console", { brand: ["Nintendo"], type: "Game Consoles", condition: NEW }, { was: 1900000 }]
    ]
  },
  {
    key: "pearl",
    businessName: "Pearl Mobile Gulu",
    description: "Northern Uganda's trusted phone shop. All devices tested and activated before you leave.",
    district: "Gulu", area: "Gulu City", lat: 2.7746, lng: 32.2990, phone: "+256700100109", avatar: "phone",
    products: [
      [CAT.PHONE, "iPhone 12 64GB Blue", 1650000, "phone", { brand: "Apple", condition: ["Used"], internalStorage: ["64 GB"], ram: ["4 GB"], color: ["Blue"], classType: ["Smartphones"], numberOfSims: ["Dual SIM"], displayTechnology: ["OLED"], displaySize: ['6.1-6.5"'], highlights: ["5G"], exchangePossible: true }, {}],
      [CAT.PHONE, "iPhone 11 128GB Black", 1250000, "phone", { brand: "Apple", condition: ["Refurbished"], internalStorage: ["128 GB"], ram: ["4 GB"], color: ["Black"], classType: ["Smartphones"], numberOfSims: ["Dual SIM"], displayTechnology: ["IPS"], displaySize: ['6.1-6.5"'], exchangePossible: true }, { was: 1400000 }],
      [CAT.PHONE, "Samsung Galaxy A14 64GB", 520000, "phone", { brand: "Samsung", condition: NEW, internalStorage: ["64 GB"], ram: ["4 GB"], color: ["Black"], classType: ["Smartphones"], numberOfSims: ["Dual SIM"], displayTechnology: ["PLS"], displaySize: ['6.6-6.8"'], highlights: ["Dual SIM", "5000 mAh+"], exchangePossible: true }, {}],
      [CAT.PHONE, "Samsung Galaxy S21 FE 128GB", 1480000, "phone", { brand: "Samsung", condition: ["Used"], internalStorage: ["128 GB"], ram: ["6 GB"], color: ["Graphite"], classType: ["Smartphones"], numberOfSims: ["Dual SIM"], displayTechnology: ["AMOLED"], displaySize: ['6.6-6.8"'], highlights: ["5G", "AMOLED"], exchangePossible: true }, {}],
      [CAT.PHONE, "Tecno Camon 20 256GB", 790000, "phone", { brand: "Tecno", condition: NEW, internalStorage: ["256 GB"], ram: ["8 GB"], color: ["Blue"], classType: ["Smartphones"], numberOfSims: ["Dual SIM"], displayTechnology: ["AMOLED"], displaySize: ['6.6-6.8"'], highlights: ["AMOLED", "Dual SIM"], exchangePossible: false }, { desc: "64MP camera and fast charging." }],
      [CAT.PHONE, "Itel A60s 64GB Budget Smartphone", 280000, "phone", { brand: "Itel", condition: NEW, internalStorage: ["64 GB"], ram: ["3 GB"], color: ["Black"], classType: ["Smartphones"], numberOfSims: ["Dual SIM"], displayTechnology: ["IPS"], displaySize: ['6.6-6.8"'], highlights: ["Dual SIM", "5000 mAh+"], exchangePossible: true }, {}],
      [CAT.PHONE, "Oppo A78 256GB", 910000, "phone", { brand: "Oppo", condition: NEW, internalStorage: ["256 GB"], ram: ["8 GB"], color: ["Black"], classType: ["Smartphones"], numberOfSims: ["Dual SIM"], displayTechnology: ["AMOLED"], displaySize: ['6.6-6.8"'], highlights: ["AMOLED", "NFC"], exchangePossible: false }, { was: 980000 }],
      [CAT.TABLET, "Lenovo Tab M10 Plus 64GB", 640000, "tablet", { brand: "Lenovo", condition: NEW, screenSize: ['9-10.9"'], color: ["Gray"], storageCapacity: ["64 GB"], operatingSystem: ["Android"] }, {}],
      [CAT.TABLET, "Apple iPad Air 5th Gen 64GB", 2750000, "tablet", { brand: "Apple", condition: NEW, screenSize: ['9-10.9"'], color: ["Blue"], storageCapacity: ["64 GB"], operatingSystem: ["iOS"], exchangePossible: false }, { was: 2950000 }],
      [CAT.HEADPHONES, "Oraimo FreePods 4 Wireless Earbuds", 125000, "earbuds", { brand: "Oraimo", type: ["In-Ear"], connectivity: ["Wireless"], color: ["Black"], condition: NEW, features: ["Active Noise Cancellation"], highlights: ["True Wireless"] }, {}],
      [CAT.HEADPHONES, "Beats Studio3 Wireless Headphones", 780000, "headphones", { brand: "Beats", type: ["Over-Ear"], connectivity: ["Wireless"], color: ["Gold"], condition: NEW, features: ["Active Noise Cancellation"] }, {}],
      [CAT.SMARTWATCH, "Huawei Watch GT 3 46mm", 860000, "smartwatch", { brand: "Huawei", type: "Smart Watches", bandColor: ["Black"], condition: NEW }, {}],
      [CAT.SMARTWATCH, "Amazfit Bip 3 Pro Fitness Watch", 330000, "smartwatch", { brand: "Amazfit", type: "Fitness Trackers", bandColor: ["Black"], condition: NEW }, { was: 370000 }],
      [CAT.CAMERA, "Nikon D3500 DSLR with Kit Lens", 1650000, "camera", { type: "DSLR", make: ["Nikon"], condition: NEW }, {}]
    ]
  },
  {
    key: "elgon",
    businessName: "Elgon Home Store",
    description: "Everything for the home in Mbale: furniture, kitchen appliances and cookware, delivered across Eastern Uganda.",
    district: "Mbale", area: "Mbale City", lat: 1.0827, lng: 34.1750, phone: "+256700100110", avatar: "dining",
    products: [
      [CAT.FURNITURE, "Corner Sofa Set 7-Seater Cream", 2600000, "sofa", { type: "Sofas", condition: NEW, room: ["Living Room"], material: ["Fabric"], color: ["Beige"] }, { was: 2900000 }],
      [CAT.FURNITURE, "Chesterfield Brown Leather Sofa", 2200000, "sofa", { type: "Sofas", condition: NEW, room: ["Living Room"], material: ["Leather"], color: ["Brown"] }, {}],
      [CAT.FURNITURE, "Modern Dining Table 8 Seater", 2350000, "dining", { type: "Dining Tables", condition: NEW, room: ["Dining Room"], material: ["Wood"], color: ["Brown"] }, {}],
      [CAT.FURNITURE, "Round Dining Table with 4 Chairs", 980000, "dining", { type: "Dining Tables", condition: NEW, room: ["Dining Room"], material: ["Wood"], color: ["White"] }, { was: 1100000 }],
      [CAT.FURNITURE, "Double Bed with Mattress Combo", 1480000, "bed", { type: "Beds & Bed Frames", condition: NEW, room: ["Bedroom"], material: ["Wood"], color: ["Brown"] }, {}],
      [CAT.FURNITURE, "Mahogany Wardrobe 3-Door", 1350000, "storage", { type: "Wardrobes", condition: NEW, room: ["Bedroom"], material: ["Wood"], color: ["Brown"] }, { desc: "Solid mahogany with full-length mirror." }],
      [CAT.FURNITURE, "Cushioned Armchair Pair", 760000, "armchair", { type: "Armchairs", condition: NEW, room: ["Living Room"], color: ["Gray"] }, {}],
      [CAT.FURNITURE, "Executive Office Chair Leather", 540000, "officeChair", { type: "Office Chairs", condition: NEW, room: ["Home Office"], material: ["Leather"], color: ["Black"] }, {}],
      [CAT.KITCHEN, "Ramtons Blender 1.5L 600W", 185000, "blender", { type: "Blenders", condition: NEW, brand: ["Ramtons"] }, { desc: "Four-speed blender with grinder attachment." }],
      [CAT.KITCHEN, "Panasonic Microwave Oven 25L", 420000, "microwave", { type: "Microwave Ovens", condition: NEW, brand: ["Panasonic"] }, { was: 470000 }],
      [CAT.KITCHEN, "Hotpoint 4-Burner Gas Cooker with Oven", 1250000, "cooker", { type: "Cookers", condition: NEW, brand: ["Hotpoint"] }, {}],
      [CAT.KITCHEN, "Kenwood Stand Mixer 1000W", 860000, "blender", { type: "Mixers", condition: NEW, brand: ["Kenwood"] }, {}],
      [CAT.COOKWARE, "Stainless Steel Cookware Set 12 Pieces", 340000, "cookware", { type: "Cookware Sets", condition: "Brand New", brand: ["Tefal"], color: ["Gray"] }, { was: 390000 }],
      [CAT.APPLIANCE, "Samsung Top-Load Washing Machine 7kg", 1250000, "washer", { type: "Washing Machines", brand: ["Samsung"], condition: NEW }, {}]
    ]
  }
];

// Services offered alongside products, so provider pages can show separate Products / Services tabs.
// provider key -> [name, priceUGX, imagePool, description]
export const SERVICES = {
  techhub: [
    ["Laptop screen replacement and repair", 180000, "laptop", "Cracked screen, dead keyboard or slow machine? Same-day repair with a 3-month guarantee."],
    ["Data recovery and Windows reinstall", 90000, "laptop", "We rescue files from failing drives and set up a clean, activated Windows."],
    ["Office network and printer setup", 250000, "printer", "Wi-Fi, cabling and shared printers configured on site across Kampala."]
  ],
  gadget: [
    ["Phone screen and battery replacement", 120000, "phone", "Genuine-quality parts for iPhone and Samsung, done while you wait."]
  ],
  bulenga: [
    ["Furniture assembly and delivery", 150000, "sofa", "We deliver, assemble and position your furniture anywhere in Wakiso and Kampala."],
    ["Upholstery repair and re-covering", 300000, "armchair", "Give old sofas and armchairs a new life with fresh fabric or leather."]
  ],
  lakeside: [
    ["Pre-purchase vehicle inspection", 200000, "suv", "Full mechanical and bodywork check with a written report before you buy."],
    ["Car valuation and import advice", 150000, "sedan", "Honest market valuation and duty estimates for Japanese imports."]
  ],
  ankole: [
    ["TV wall mounting and sound installation", 120000, "tv", "Professional mounting, cable hiding and home-theatre setup in Mbarara."]
  ]
};

// Hero ads shown on the Shop page carousel (provider key, title, subtitle, image id, cta).
export const ADS = [
  { provider: "techhub", title: "Back-to-work laptop deals", subtitle: "Refurbished HP, Dell and Lenovo from UGX 720,000 with warranty", image: "1496181133206-80ce9b88a853", cta: "Shop laptops" },
  { provider: "gadget", title: "iPhone 14 Pro Max in stock", subtitle: "Trade in your old phone at Gadget Galaxy, Ntinda", image: "1592890288564-76628a30a657", cta: "See phones" },
  { provider: "bulenga", title: "Free delivery on sofas", subtitle: "Order any sofa above UGX 500,000 within Kampala and Wakiso", image: "1555041469-a586c61ea9bc", cta: "Browse furniture" },
  { provider: "lakeside", title: "Clean Japanese imports", subtitle: "Land Cruiser Prado, RAV4 and Harrier ready for test drive", image: "1650530579355-7ad9d4766043", cta: "View cars" }
];
