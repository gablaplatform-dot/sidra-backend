import { formatUgx } from "./format";

const PLACEHOLDER_COVER = "https://coresg-normal.trae.ai/api/ide/v1/text_to_image?prompt=premium%20product%20packaging%20minimal%20white%20background&image_size=square_hd";
const PLACEHOLDER_CATEGORY = "https://coresg-normal.trae.ai/api/ide/v1/text_to_image?prompt=abstract%20pastel%20beige%20gradient%20mesh%20background&image_size=square_hd";
const PLACEHOLDER_PROMO = "https://coresg-normal.trae.ai/api/ide/v1/text_to_image?prompt=abstract%20orange%20coral%20gradient%20mesh%20banner&image_size=landscape_16_9";

export const listingCover = (listing) => {
  const media = listing?.media;
  if (!media) return PLACEHOLDER_COVER;
  if (typeof media === "object" && media.imageUrl) return media.imageUrl;
  if (typeof media === "object" && Array.isArray(media.gallery) && media.gallery[0]) return media.gallery[0];
  if (typeof media === "string") return media;
  return PLACEHOLDER_COVER;
};

export const mapCategoryDto = (cat) => ({
  id: cat?.id ?? `cat-${Math.random().toString(36).slice(2, 8)}`,
  name: cat?.name ?? "Category",
  image: cat?.imageUrl ?? PLACEHOLDER_CATEGORY
});

export const mapProductDto = (p, opts = {}) => {
  const reviews = Number(p?.viewCount ?? p?.soldCount ?? 0) || 0;
  const syntheticReviews = Math.max(reviews + (opts.reviewOffset ?? 0), reviews);
  const base = {
    id: p?.id,
    name: p?.name ?? "Product",
    price: formatUgx(p?.price ?? 0),
    originalPrice: p?.originalPrice && Number(p.originalPrice) > Number(p?.price ?? 0)
      ? formatUgx(p.originalPrice)
      : null,
    discount: p?.discountPercent ? `-${Number(p.discountPercent)}%` : null,
    isNew: Boolean(p?.isNew),
    rating: 4.5 + Math.min(0.5, (Number(p?.soldCount ?? 0) % 10) / 20),
    reviews: syntheticReviews + Math.round(((Number(p?.id ?? "0").charCodeAt(0) || 0) % 7) * 123),
    image: listingCover(p),
    description: p?.description?.slice(0, 90) ?? "Premium product crafted for quality and comfort."
  };
  if (p?.soldCount && base.reviews < p.soldCount) base.reviews = p.soldCount;
  return base;
};

export const mapPromotionDto = (promo) => {
  const type = String(promo?.type ?? "banner");
  return {
    id: promo?.id,
    type,
    title: promo?.title ?? "Limited Offer",
    subtitle: promo?.subtitle ?? "",
    tag: promo?.subtitle ?? promo?.title,
    cta: promo?.ctaLabel ?? "Shop Now",
    ctaHref: promo?.ctaHref ?? "/shop",
    image: promo?.imageUrl ?? PLACEHOLDER_PROMO,
    remainingSecs: Number(promo?.remainingSecs ?? 0),
    startsInSecs: Number(promo?.startsInSecs ?? 0),
    isActiveNow: Boolean(promo?.isActiveNow),
    discountPercent: promo?.discountPercent ?? null,
    sortOrder: Number(promo?.sortOrder ?? 0),
    isFeatured: Boolean(promo?.isFeatured)
  };
};
