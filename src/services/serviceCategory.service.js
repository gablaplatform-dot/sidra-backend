import { prisma } from "../config/db.js";
import { ProductCategoryService } from "./productCategory.service.js";

export const BOOKING_UNITS = ["night", "day", "hour"];

// The category tree for services. Same behaviour as the product tree (admin manages it, providers can
// add subcategories, each node carries the questions a provider answers) on its own table, plus a
// hint that services in a node are normally booked, and by which unit.
export class ServiceCategoryService extends ProductCategoryService {
  get db() {
    return prisma.serviceCategory;
  }

  pickExtra(input = {}) {
    const extra = {};
    if (input.bookable !== undefined) extra.bookable = Boolean(input.bookable);
    if (input.bookingUnit !== undefined) extra.bookingUnit = input.bookingUnit && BOOKING_UNITS.includes(input.bookingUnit) ? input.bookingUnit : null;
    return extra;
  }

  toDto(category) {
    return { ...super.toDto(category), bookable: Boolean(category.bookable), bookingUnit: category.bookingUnit ?? null };
  }
}
