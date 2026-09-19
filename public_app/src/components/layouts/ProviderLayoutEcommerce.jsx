import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { request } from "../../lib/api";
import { addToCart } from "../../lib/cart";
import ContactSidebar from "../ContactSidebar";
import ProviderCustomFields, { hasAnsweredCustomFields } from "../ProviderCustomFields";
import OrderModal from "../OrderModal";
import BuyNowModal from "../BuyNowModal";
import { IconBox, IconCart, IconChevronLeft, IconImage, IconShield, IconStar, IconStore } from "../icons";

const initials = (value) => (value || "G").trim().slice(0, 1).toUpperCase();

const collectIds = (node) => [node.id, ...(node.children || []).flatMap(collectIds)];

// Products are paid for instantly by mobile money; services go through the request/arrange
// Order flow instead, since they typically need scheduling or a quote first. A product also
// falls back to the request flow when either the provider or the listing itself has online
// payment switched off.
const ListingChip = ({ item, onlinePaymentsAllowed, onOrder, onBuyNow }) => {
  const canBuyNow = item.type === "product" && onlinePaymentsAllowed && item.onlinePaymentEnabled !== false;
  const [added, setAdded] = useState(false);
  const handleAddToCart = () => {
    addToCart(item.id, 1);
    setAdded(true);
    setTimeout(() => setAdded(false), 1500);
  };
  return (
    <div className="listing-card">
      <div className="listing-cover" style={item.media?.imageUrl ? { backgroundImage: `url("${item.media.imageUrl}")` } : undefined}>
        {!item.media?.imageUrl ? <IconBox /> : null}
      </div>
      <div className="listing-body">
        <h3>{item.name}</h3>
        <p className="provider-meta">{item.type === "product" ? "Product" : "Service"}</p>
        {Number(item.price) > 0 ? <div className="listing-price">UGX {Number(item.price).toLocaleString()}</div> : null}
        {canBuyNow ? (
          <div className="listing-actions-row">
            <button type="button" className="cta-button ecommerce-order-button" onClick={() => onBuyNow(item)}>Buy now</button>
            <button type="button" className="secondary-button ecommerce-cart-button" onClick={handleAddToCart} aria-label="Add to cart">
              {added ? "Added" : <><IconCart /> Add</>}
            </button>
          </div>
        ) : (
          <button type="button" className="cta-button ecommerce-order-button" onClick={() => onOrder(item)}>Order now</button>
        )}
      </div>
    </div>
  );
};

export default function ProviderLayoutEcommerce({ provider, categoryId, categoryName, providerFields = [], listings, gallery, onUnlock }) {
  const onlinePaymentsAllowed = provider.onlinePaymentsEnabled !== false;
  const [orderingItem, setOrderingItem] = useState(null);
  const [buyingItem, setBuyingItem] = useState(null);
  const [shopCategoryTree, setShopCategoryTree] = useState([]);
  const [selectedShopCategoryId, setSelectedShopCategoryId] = useState(null);

  useEffect(() => {
    let active = true;
    request(`/shop-categories/provider/${encodeURIComponent(provider.id)}`)
      .then((result) => {
        if (active) setShopCategoryTree(result?.items || []);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [provider.id]);

  const findNode = (nodes, id) => {
    for (const node of nodes) {
      if (node.id === id) return node;
      const found = findNode(node.children || [], id);
      if (found) return found;
    }
    return null;
  };

  const countInCategory = (node) => {
    const ids = new Set(collectIds(node));
    return listings.filter((l) => l.shopCategoryId && ids.has(l.shopCategoryId)).length;
  };

  const selectedNode = selectedShopCategoryId ? findNode(shopCategoryTree, selectedShopCategoryId) : null;
  const selectedIds = selectedNode ? new Set(collectIds(selectedNode)) : null;
  const filteredListings = selectedIds ? listings.filter((l) => l.shopCategoryId && selectedIds.has(l.shopCategoryId)) : listings;

  const newArrivals = [...listings].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 10);
  const bestSellers = listings.filter((item) => item.featured);
  const previewItems = listings.slice(0, 2);

  return (
    <>
      <section className="ecommerce-hero" style={provider.media?.coverUrl ? { backgroundImage: `url("${provider.media.coverUrl}")` } : undefined}>
        <div className="ecommerce-hero-overlay" />
        <Link to={categoryId ? `/category/${categoryId}` : "/home"} className="banner-back ecommerce-back">
          <IconChevronLeft /> {categoryId ? categoryName : "Home"}
        </Link>
        <div className="ecommerce-hero-grid">
          <div className="ecommerce-hero-copy">
            <p className="ecommerce-eyebrow">{categoryName}</p>
            <h1>{provider.businessName}</h1>
            {provider.description ? <p className="ecommerce-hero-desc">{provider.description}</p> : null}
            <div className="ecommerce-hero-actions">
              <a href="#shop" className="cta-button">Shop now</a>
              <a href="#about" className="secondary-button ecommerce-ghost-button">Get in touch</a>
            </div>
            <div className="hero-trust ecommerce-hero-trust">
              <span><IconStar /> {provider.ratingAvg ? provider.ratingAvg.toFixed(1) : "New"}{provider.ratingCount ? ` (${provider.ratingCount})` : ""}</span>
              <span className="hero-trust-dot">&middot;</span>
              <span><IconShield /> Verified provider</span>
              <span className="hero-trust-dot">&middot;</span>
              <span><IconStore /> {listings.length} listed</span>
            </div>
          </div>
          {previewItems.length ? (
            <div className="ecommerce-hero-visual">
              {previewItems.map((item, index) => (
                <div key={item.id} className={`ecommerce-floating-card ecommerce-floating-card-${index}`}>
                  <div
                    className="ecommerce-floating-thumb"
                    style={item.media?.imageUrl ? { backgroundImage: `url("${item.media.imageUrl}")` } : undefined}
                  >
                    {!item.media?.imageUrl ? <IconBox /> : null}
                  </div>
                  <div>
                    <strong>{item.name}</strong>
                    {Number(item.price) > 0 ? <span>UGX {Number(item.price).toLocaleString()}</span> : null}
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </section>

      {shopCategoryTree.length ? (
        <section className="home-section ecommerce-section" id="shop">
          <h2>Shop by category</h2>
          <div className="category-grid">
            {shopCategoryTree.map((cat) => (
              <button
                type="button"
                key={cat.id}
                className={`category-card ${selectedShopCategoryId === cat.id ? "is-active" : ""}`}
                onClick={() => setSelectedShopCategoryId((current) => (current === cat.id ? null : cat.id))}
              >
                <div className="category-label">
                  <span className="category-icon">{initials(cat.name)}</span>
                  <span className="category-name">{cat.name} &middot; {countInCategory(cat)}</span>
                </div>
              </button>
            ))}
          </div>
        </section>
      ) : null}

      {selectedNode ? (
        <section className="home-section ecommerce-section">
          <div className="detail-block-header">
            <h2>{selectedNode.name}</h2>
            <button type="button" className="secondary-button" onClick={() => setSelectedShopCategoryId(null)}>Show everything</button>
          </div>
          {filteredListings.length ? (
            <div className="listing-grid">
              {filteredListings.map((item) => <ListingChip key={item.id} item={item} onlinePaymentsAllowed={onlinePaymentsAllowed} onOrder={setOrderingItem} onBuyNow={setBuyingItem} />)}
            </div>
          ) : (
            <div className="empty-state">
              <IconBox />
              <p>Nothing in this category yet.</p>
            </div>
          )}
        </section>
      ) : (
        <>
          <section className="home-section ecommerce-section" id={shopCategoryTree.length ? undefined : "shop"}>
            <h2>New arrivals</h2>
            {newArrivals.length ? (
              <div className="ecommerce-scroll-row">
                {newArrivals.map((item) => <ListingChip key={item.id} item={item} onlinePaymentsAllowed={onlinePaymentsAllowed} onOrder={setOrderingItem} onBuyNow={setBuyingItem} />)}
              </div>
            ) : (
              <div className="empty-state">
                <IconBox />
                <p>No products or services listed yet.</p>
              </div>
            )}
          </section>

          {bestSellers.length ? (
            <section className="home-section ecommerce-section">
              <h2>Best sellers</h2>
              <div className="listing-grid">
                {bestSellers.map((item) => <ListingChip key={item.id} item={item} onlinePaymentsAllowed={onlinePaymentsAllowed} onOrder={setOrderingItem} onBuyNow={setBuyingItem} />)}
              </div>
            </section>
          ) : null}
        </>
      )}

      <div className="provider-detail-grid" id="about">
        <div className="provider-detail-main">
          {provider.description || hasAnsweredCustomFields(providerFields, provider.customFields) ? (
            <section className="detail-block">
              <h2>About {provider.businessName}</h2>
              {provider.description ? <p className="provider-description">{provider.description}</p> : null}
              <ProviderCustomFields fields={providerFields} values={provider.customFields} />
            </section>
          ) : null}

          <section className="detail-block">
            <h2>Gallery</h2>
            {gallery.length ? (
              <div className="gallery-grid">
                {gallery.slice(0, 6).map((url) => (
                  <div key={url} className="gallery-item" style={{ backgroundImage: `url("${url}")` }} />
                ))}
              </div>
            ) : (
              <div className="empty-state">
                <IconImage />
                <p>No gallery photos yet.</p>
              </div>
            )}
          </section>
        </div>

        <aside className="provider-detail-sidebar">
          <ContactSidebar provider={provider} onUnlock={onUnlock} />
        </aside>
      </div>

      {orderingItem ? (
        <OrderModal listing={orderingItem} providerId={provider.id} onClose={() => setOrderingItem(null)} />
      ) : null}

      {buyingItem ? (
        <BuyNowModal listing={buyingItem} onClose={() => setBuyingItem(null)} />
      ) : null}
    </>
  );
}
