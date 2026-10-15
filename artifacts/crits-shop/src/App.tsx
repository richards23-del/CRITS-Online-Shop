import { type FormEvent, type ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import './site.css';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { Link, Route, Switch, Router as WouterRouter, useLocation, useParams } from 'wouter';
import { ClerkProvider, SignIn, SignUp, useClerk } from '@clerk/react';
import { publishableKeyFromHost } from '@clerk/react/internal';
import { shadcn } from '@clerk/themes';
import {
  getCheckAdminAccessQueryKey, getGetAdminOverviewQueryKey, getListAdminCategoriesQueryKey,
  getGetAdminSettingsQueryKey, getListAdminEnquiriesQueryKey, getListAdminProductsQueryKey,
  getListCategoriesQueryKey, getListProductsQueryKey, useCheckAdminAccess, useCreateAdminCategory,
  useCreateAdminProduct, useCreateEnquiry, useGetAdminOverview, useGetAdminSettings, useGetProduct,
  useHealthCheck, useImportAdminProducts, useListAdminCategories, useListAdminEnquiries,
  useListAdminProducts, useListCategories, useListProducts, useRecordAnalyticsEvent,
  useRequestProductImageUpload, useUpdateAdminCategory, useUpdateAdminEnquiry,
  useUpdateAdminProduct, useUpdateAdminSettings,
} from '@workspace/api-client-react';
import type { AdminEnquiry, EnquiryInput, Product, ProductInput } from '@workspace/api-client-react';
import {
  ArrowDownToLine, ArrowLeft, ArrowRight, ArrowUpRight, BadgeCheck, Boxes, BriefcaseBusiness,
  Check, CheckCircle2, ChevronDown, CircleHelp, ClipboardList, Clock3, FileText, Filter, HardDrive,
  Headset, LayoutDashboard, LockKeyhole, Mail, Menu, MessageCircle, Package, Phone, Plus, Search,
  Send, ShieldCheck, ShoppingBasket, SlidersHorizontal, Tag, Upload, Users, X,
} from 'lucide-react';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';

const queryClient = new QueryClient();
const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');
const base = basePath;
const clerkPubKey = publishableKeyFromHost(
  window.location.hostname,
  import.meta.env.VITE_CLERK_PUBLISHABLE_KEY,
);
const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;
if (!clerkPubKey) throw new Error('Missing VITE_CLERK_PUBLISHABLE_KEY in .env file');
const phoneMain = '0200 901 530';
const whatsapp = '0788 885 947';
const email = 'fairpricesolutions03@gmail.com';

type BasketLine = { product: Product; quantity: number };
const getBasket = (): BasketLine[] => {
  try { return JSON.parse(localStorage.getItem('crits-enquiry-basket') || '[]') as BasketLine[]; } catch { return []; }
};
const saveBasket = (lines: BasketLine[]) => localStorage.setItem('crits-enquiry-basket', JSON.stringify(lines));
const money = (amount?: number | null) => amount == null ? 'Request a quote' : `UGX ${amount.toLocaleString('en-UG')}`;
const human = (text: string) => text.replaceAll('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase());
const slugify = (text: string) => text.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

function IconLink({ href, children, className = '' }: { href: string; children: ReactNode; className?: string }) {
  return <Link href={href} className={className}>{children}</Link>;
}
function Button({ children, onClick, href, variant = 'primary', disabled = false, testid }: { children: ReactNode; onClick?: () => void; href?: string; variant?: 'primary' | 'outline' | 'quiet' | 'orange'; disabled?: boolean; testid?: string }) {
  const classes = `button button-${variant} ${disabled ? 'opacity-50 pointer-events-none' : ''}`;
  if (href) return <Link href={href} className={classes} data-testid={testid}>{children}</Link>;
  return <button type="button" className={classes} onClick={onClick} disabled={disabled} data-testid={testid}>{children}</button>;
}
function Brand({ inverse = false }: { inverse?: boolean }) {
  return <Link href="/" className="brand" aria-label="CRITS Limited home" data-testid="link-home-logo"><img src={`${base}/crits-logo.png`} alt="CRITS Quality Redefined" />{inverse && <span className="sr-only">CRITS Limited</span>}</Link>;
}
function Header() {
  const [open, setOpen] = useState(false);
  const [path] = useLocation();
  useEffect(() => setOpen(false), [path]);
  const nav = <><Link href="/catalog" data-testid="link-catalog">Catalogue</Link><Link href="/services" data-testid="link-services">Services</Link><Link href="/about" data-testid="link-about">About us</Link><Link href="/contact" data-testid="link-contact">Contact</Link></>;
  return <header className="site-header">
    <div className="utility"><div className="site-width utility-inner"><span>Technology & business IT, thoughtfully sourced.</span><div><a href={`https://wa.me/256${whatsapp.replace(/\D/g, '').slice(1)}`} data-testid="link-whatsapp-top"><MessageCircle size={14} /> WhatsApp {whatsapp}</a><a href={`mailto:${email}`} data-testid="link-email-top"><Mail size={14} /> {email}</a></div></div></div>
    <div className="site-width nav-row"><Brand /><nav className="desktop-nav" aria-label="Main navigation">{nav}</nav><div className="nav-actions"><Link href="/basket" className={`basket-link ${path === '/basket' ? 'active' : ''}`} data-testid="link-basket"><ShoppingBasket size={18} /><span>Enquiry basket</span><BasketCount /></Link><Button href="/contact" variant="orange" testid="button-header-quote">Request a quote <ArrowRight size={16} /></Button></div><button aria-label={open ? 'Close menu' : 'Open menu'} className="menu-toggle" onClick={() => setOpen(!open)} data-testid="button-menu"><Menu size={22} /></button></div>
    {open && <nav className="mobile-nav" aria-label="Mobile navigation">{nav}<Link href="/basket">Enquiry basket</Link></nav>}
  </header>;
}
function BasketCount() {
  const [count, setCount] = useState(0);
  useEffect(() => {
    const update = () => setCount(getBasket().reduce((sum, item) => sum + item.quantity, 0));
    update(); window.addEventListener('storage', update); window.addEventListener('crits-basket-change', update);
    return () => { window.removeEventListener('storage', update); window.removeEventListener('crits-basket-change', update); };
  }, []);
  return <span className="count-pill" data-testid="text-basket-count">{count}</span>;
}
function Footer() {
  return <footer className="site-footer"><div className="site-width footer-grid"><div><Brand inverse /><p>CRITS Limited<br />Technology and business IT supply.</p></div><div><h3>Explore</h3><Link href="/catalog">Product catalogue</Link><Link href="/services">Services</Link><Link href="/about">About CRITS</Link><Link href="/privacy">Privacy notice</Link></div><div><h3>Talk to our team</h3><a href={`https://wa.me/256${whatsapp.replace(/\D/g, '').slice(1)}`}><MessageCircle size={15} /> WhatsApp {whatsapp}</a><a href={`tel:+256${phoneMain.replace(/\D/g, '').slice(1)}`}><Phone size={15} /> {phoneMain}</a><a href={`tel:+256414670451`}><Phone size={15} /> 0414 670 451</a><a href={`tel:+256393243318`}><Phone size={15} /> 0393 243 318</a><a href={`mailto:${email}`}><Mail size={15} /> {email}</a></div><div className="footer-note"><span className="eyebrow">CRITS LIMITED</span><p>Questions before you choose? We’ll help you find the right fit.</p><Button href="/contact" variant="outline">Get in touch <ArrowUpRight size={16} /></Button></div></div><div className="site-width copyright"><span>© {new Date().getFullYear()} CRITS Limited</span><span>Product information is confirmed by our team before publication.</span></div></footer>;
}
function Shell({ children }: { children: ReactNode }) {
  return <><Header /><main>{children}</main><Footer /></>;
}
function PageHeading({ kicker, title, copy }: { kicker: string; title: string; copy?: string }) {
  return <div className="page-heading"><span className="eyebrow">{kicker}</span><h1>{title}</h1>{copy && <p>{copy}</p>}</div>;
}
function ContactBand() {
  return <section className="contact-band site-width"><div><span className="eyebrow">NEED A HAND?</span><h2>Tell us what your work needs.</h2><p>Share a little context. Our team can help with product questions and quote requests.</p></div><Button href="/contact" variant="orange">Talk to CRITS <ArrowRight size={17} /></Button></section>;
}
function QueryFailure({ retry }: { retry: () => void }) {
  return <div className="state-panel error-state"><CircleHelp /><h3>We couldn’t load this just now.</h3><p>Please try again in a moment, or contact our team directly.</p><button className="text-button" onClick={retry} data-testid="button-retry">Try again <ArrowRight size={15} /></button></div>;
}
function ProductCard({ product }: { product: Product }) {
  const [lines, setLines] = useState(getBasket);
  const add = () => {
    const next = lines.some((line) => line.product.id === product.id)
      ? lines.map((line) => line.product.id === product.id ? { ...line, quantity: line.quantity + 1 } : line)
      : [...lines, { product, quantity: 1 }];
    setLines(next); saveBasket(next); window.dispatchEvent(new Event('crits-basket-change'));
  };
  return <article className="product-card" data-testid={`card-product-${product.id}`}>
    <IconLink href={`/products/${product.slug}`} className="product-image">
      {product.imageUrls[0] ? <img src={product.imageUrls[0]} alt={product.title} /> : <div className="image-placeholder"><Package size={34} /><span>Product image</span></div>}
      {product.featured && <span className="featured-tag">Featured</span>}
    </IconLink>
    <div className="product-card-body"><div className="product-meta"><span>{product.categoryName}</span><span>{human(product.condition)}</span></div><IconLink href={`/products/${product.slug}`} className="product-title">{product.title}</IconLink>{(product.brand || product.model) && <p className="product-sub">{[product.brand, product.model].filter(Boolean).join(' · ')}</p>}
      <div className="card-bottom"><div><strong>{money(product.priceUgx)}</strong><small>{product.availability === 'available' ? 'Availability confirmed on request' : human(product.availability)}</small></div><button className="round-action" aria-label={`Add ${product.title} to enquiry basket`} onClick={add} data-testid={`button-add-product-${product.id}`}><Plus size={18} /></button></div>
    </div>
  </article>;
}
function ProductSkeletons() {
  return <div className="product-grid" aria-label="Loading catalogue">{[1, 2, 3, 4].map((n) => <div className="skeleton-card" key={n}><div className="skeleton-img" /><div className="skeleton-line" /><div className="skeleton-line short" /></div>)}</div>;
}
function Home() {
  const health = useHealthCheck();
  const products = useListProducts({ featured: true, pageSize: 4 });
  const cats = useListCategories();
  return <Shell>
    <section className="hero">
      <div className="hero-pattern" />
      <div className="site-width hero-content"><div className="hero-copy page-enter"><div className="hero-badge"><span className="status-dot" /> Product sourcing, made clearer</div><h1>IT that keeps<br /><em>work moving.</em></h1><p>Explore technology selected for business use. Tell us what you need and our team will help you request a considered quote.</p><div className="hero-actions"><Button href="/catalog" variant="orange">Explore the catalogue <ArrowRight size={17} /></Button><Button href="/services" variant="outline">How we can help <ArrowUpRight size={16} /></Button></div><div className="hero-proof"><span><ShieldCheck size={17} /> Verified product listings</span><span><MessageCircle size={17} /> Talk to a real team</span></div></div>
        <div className="hero-visual" aria-label="CRITS technology sourcing"><div className="hero-orbit orbit-one" /><div className="hero-orbit orbit-two" /><div className="hero-chip chip-blue"><HardDrive size={23} /><span>Business IT</span></div><div className="hero-chip chip-orange"><BadgeCheck size={21} /><span>Verified listings</span></div><div className="hero-monogram">C<span>R</span>ITS</div><div className="hero-caption"><span>BUILT AROUND YOUR WORK</span><b>Quality, redefined.</b></div><div className="hero-stamp">CRITS<br /><small>LIMITED</small></div></div>
      </div><div className="hero-bottom site-width"><span>Clear product information</span><i /><span>No online checkout</span><i /><span>Quotes handled by our team</span></div>
    </section>
    <section className="section site-width intro-section"><div className="section-label"><span>01 / FIND YOUR FIT</span><span className="label-line" /></div><div className="intro-grid"><div><h2>A better way to<br />source your next <em>setup.</em></h2></div><div><p>Compare the details that matter, then send an enquiry when you’re ready. Every catalogue listing is reviewed by CRITS staff before it appears here.</p><Button href="/catalog" variant="quiet">Browse all products <ArrowRight size={16} /></Button></div></div></section>
    <section className="category-section"><div className="site-width"><div className="section-top"><div><span className="eyebrow">EXPLORE BY NEED</span><h2>Start with the work.</h2></div><IconLink href="/catalog" className="text-button">View catalogue <ArrowRight size={15} /></IconLink></div>
      {cats.isLoading ? <div className="category-loading">Loading categories…</div> : cats.isError ? <QueryFailure retry={() => cats.refetch()} /> : cats.data?.length ? <div className="category-list">{cats.data.filter((c) => c.active).map((cat, i) => <IconLink href={`/catalog?category=${encodeURIComponent(cat.slug)}`} className="category-row" key={cat.id} data-testid={`link-category-${cat.id}`}><span className="category-index">0{i + 1}</span><span className="category-name">{cat.name}</span><span className="category-desc">{cat.description || `${cat.productCount} listed products`}</span><ArrowUpRight size={18} /></IconLink>)}</div> : <div className="empty-inline"><Tag size={20} /><div><b>Product categories are being prepared.</b><p>Check back as approved products are added to the catalogue.</p></div></div>}
    </div></section>
    <section className="section featured-section site-width"><div className="section-top"><div><span className="eyebrow">SELECTED LISTINGS</span><h2>Worth a closer look.</h2></div><Button href="/catalog" variant="outline">Browse catalogue <ArrowRight size={16} /></Button></div>{products.isLoading ? <ProductSkeletons /> : products.isError ? <QueryFailure retry={() => products.refetch()} /> : products.data?.items.length ? <div className="product-grid">{products.data.items.map((product) => <ProductCard key={product.id} product={product} />)}</div> : <div className="empty-catalog"><div className="empty-mark"><Boxes size={28} /></div><div><span className="eyebrow">CATALOGUE IN PROGRESS</span><h3>Approved listings will appear here.</h3><p>There are no featured products yet. Our staff are building the catalogue; product listings will only appear once they’ve been reviewed.</p><Button href="/contact" variant="quiet">Ask our team instead <ArrowRight size={15} /></Button></div></div>}</section>
    <section className="trust-section"><div className="site-width trust-grid"><div className="trust-intro"><span className="eyebrow">A THOUGHTFUL PROCESS</span><h2>Useful details.<br />No guesswork.</h2><p>Product availability and pricing can change. We keep the catalogue transparent, and confirm the specifics with you when you enquire.</p></div><div className="trust-step"><span>01</span><ShieldCheck /><h3>Reviewed by staff</h3><p>Listings are checked by our team before they’re published.</p></div><div className="trust-step"><span>02</span><ClipboardList /><h3>Choose what matters</h3><p>Save products to an enquiry basket and send them in one request.</p></div><div className="trust-step"><span>03</span><Headset /><h3>Talk it through</h3><p>Our team follows up using the contact method you prefer.</p></div></div></section>
    <ContactBand /><div className="sr-only" aria-live="polite" data-testid="status-api-health">{health.data?.status ?? ''}</div>
  </Shell>;
}
function Catalog() {
  const params = new URLSearchParams(window.location.search);
  const [query, setQuery] = useState(params.get('q') || '');
  const [category, setCategory] = useState(params.get('category') || '');
  const [sort, setSort] = useState('featured');
  const [applied, setApplied] = useState(query);
  const categories = useListCategories();
  const queryParams = useMemo(() => ({ q: applied || undefined, category: category || undefined, sort: sort as 'featured' | 'newest' | 'price-low' | 'price-high' | 'popular', pageSize: 24 }), [applied, category, sort]);
  const products = useListProducts(queryParams);
  const record = useRecordAnalyticsEvent();
  useEffect(() => { if (applied.trim()) record.mutate({ data: { event: 'search', query: applied.trim() } }); }, [applied]); // analytics query intentionally records searches
  const search = (e: FormEvent) => { e.preventDefault(); setApplied(query); };
  return <Shell><div className="site-width page-wrap page-enter"><div className="breadcrumb"><Link href="/">Home</Link><span>/</span><span>Catalogue</span></div><PageHeading kicker="THE CRITS CATALOGUE" title="Find the right tools for your work." copy="Search approved listings, compare the details and send a quote enquiry when you’re ready. No online checkout." />
    <form className="catalog-controls" onSubmit={search}><label className="search-box"><Search size={18} /><input aria-label="Search products" placeholder="Search products, brands or models" value={query} onChange={(e) => setQuery(e.target.value)} data-testid="input-catalog-search" /><button type="submit" className="search-submit" data-testid="button-search">Search</button></label><label className="select-control"><Filter size={16} /><select aria-label="Filter by category" value={category} onChange={(e) => setCategory(e.target.value)} data-testid="select-category"><option value="">All categories</option>{categories.data?.filter((c) => c.active).map((c) => <option value={c.slug} key={c.id}>{c.name}</option>)}</select><ChevronDown size={15} /></label><label className="select-control"><SlidersHorizontal size={16} /><select aria-label="Sort products" value={sort} onChange={(e) => setSort(e.target.value)} data-testid="select-sort"><option value="featured">Featured first</option><option value="newest">Recently added</option><option value="popular">Most viewed</option><option value="price-low">Price: low to high</option><option value="price-high">Price: high to low</option></select><ChevronDown size={15} /></label></form>
    <div className="result-bar"><span data-testid="text-catalog-results">{products.data ? `${products.data.total} ${products.data.total === 1 ? 'listing' : 'listings'}` : 'Catalogue listings'}</span><span>Prices and availability confirmed during enquiry</span></div>
    {products.isLoading ? <ProductSkeletons /> : products.isError ? <QueryFailure retry={() => products.refetch()} /> : products.data?.items.length ? <div className="product-grid">{products.data.items.map((p) => <ProductCard key={p.id} product={p} />)}</div> : <div className="empty-catalog large"><div className="empty-mark"><Search size={27} /></div><div><span className="eyebrow">{applied || category ? 'NO MATCHES YET' : 'A NEW CATALOGUE'}</span><h3>{applied || category ? 'No listings matched those filters.' : 'The catalogue is ready for approved listings.'}</h3><p>{applied || category ? 'Try a different search or clear the category filter. Our team can also help you find what you need.' : 'CRITS staff are preparing product listings. Once approved, you’ll be able to explore the catalogue here.'}</p><div className="empty-actions"><Button href="/contact" variant="outline">Ask our team <ArrowRight size={15} /></Button>{(applied || category) && <button className="text-button" onClick={() => { setQuery(''); setApplied(''); setCategory(''); }}>Clear filters <X size={15} /></button>}</div></div></div>}
  </div><ContactBand /></Shell>;
}
function ProductDetail() {
  const { slug = '' } = useParams<{ slug: string }>();
  const productQuery = useGetProduct(slug);
  const analytics = useRecordAnalyticsEvent();
  const [quantity, setQuantity] = useState(1);
  useEffect(() => { if (productQuery.data?.product) analytics.mutate({ data: { event: 'product_view', productId: productQuery.data.product.id } }); }, [productQuery.data?.product?.id]);
  if (productQuery.isLoading) return <Shell><div className="site-width page-wrap"><div className="skeleton-detail" /></div></Shell>;
  if (productQuery.isError || !productQuery.data) return <Shell><div className="site-width page-wrap"><QueryFailure retry={() => productQuery.refetch()} /></div></Shell>;
  const p = productQuery.data.product;
  const add = () => {
    const lines = getBasket(); const found = lines.find((line) => line.product.id === p.id);
    const next = found ? lines.map((line) => line.product.id === p.id ? { ...line, quantity: line.quantity + quantity } : line) : [...lines, { product: p, quantity }];
    saveBasket(next); window.dispatchEvent(new Event('crits-basket-change'));
  };
  return <Shell><div className="site-width page-wrap page-enter"><div className="breadcrumb"><Link href="/">Home</Link><span>/</span><Link href="/catalog">Catalogue</Link><span>/</span><span>{p.title}</span></div><div className="detail-layout"><div className="detail-image">{p.imageUrls[0] ? <img src={p.imageUrls[0]} alt={p.title} /> : <div className="image-placeholder"><Package size={48} /><span>Product image</span></div>}</div><div className="detail-copy"><span className="eyebrow">{p.categoryName}</span><h1 data-testid="text-product-title">{p.title}</h1>{(p.brand || p.model) && <p className="detail-model">{[p.brand, p.model].filter(Boolean).join(' / ')}</p>}<div className="detail-price">{money(p.priceUgx)}</div><p className="detail-description">{p.description}</p><div className="detail-badges"><span><BadgeCheck size={15} /> Staff reviewed listing</span><span><Package size={15} /> {human(p.condition)}</span></div><div className="detail-availability">Availability: <b>{human(p.availability)}</b><small>Confirm current availability with our team.</small></div><div className="detail-actions"><div className="quantity-control"><button aria-label="Decrease quantity" onClick={() => setQuantity(Math.max(1, quantity - 1))}>−</button><span data-testid="text-product-quantity">{quantity}</span><button aria-label="Increase quantity" onClick={() => setQuantity(Math.min(100, quantity + 1))}>+</button></div><Button onClick={add} variant="orange" testid="button-add-to-basket">Add to enquiry basket <ShoppingBasket size={17} /></Button></div><p className="no-checkout">No payment or checkout here. Send an enquiry and we’ll follow up.</p></div></div>
    <div className="spec-panel"><div><span className="eyebrow">PRODUCT DETAILS</span><h2>Specifications</h2></div><dl>{Object.entries(p.specifications || {}).map(([key, value]) => <div key={key}><dt>{key}</dt><dd>{value}</dd></div>)}</dl></div>
    {!!productQuery.data.related.length && <section className="section related"><div className="section-top"><div><span className="eyebrow">MORE TO EXPLORE</span><h2>Related listings</h2></div><Button href="/catalog" variant="outline">All products <ArrowRight size={15} /></Button></div><div className="product-grid">{productQuery.data.related.map((x) => <ProductCard key={x.id} product={x} />)}</div></section>}
  </div><ContactBand /></Shell>;
}
function ContactForm({ initialLines = [] }: { initialLines?: BasketLine[] }) {
  const create = useCreateEnquiry();
  const [contactMethod, setContactMethod] = useState<'whatsapp' | 'phone' | 'email'>('whatsapp');
  const [successRef, setSuccessRef] = useState('');
  const [errorText, setErrorText] = useState('');
  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault(); setErrorText('');
    const form = new FormData(e.currentTarget);
    const name = String(form.get('name') || '').trim(), contactValue = String(form.get('contactValue') || '').trim();
    if (name.length < 1 || contactValue.length < 3) { setErrorText('Please enter your name and a valid contact detail.'); return; }
    const payload: EnquiryInput = {
      name, preferredContactMethod: contactMethod, contactValue,
      organisation: String(form.get('organisation') || '').trim() || null,
      locationNotes: String(form.get('locationNotes') || '').trim() || null,
      message: String(form.get('message') || '').trim() || null,
      items: initialLines.map((line) => ({ productId: line.product.id, quantity: line.quantity })),
    };
    create.mutate({ data: payload }, { onSuccess: (receipt) => { setSuccessRef(receipt.reference); if (initialLines.length) { saveBasket([]); window.dispatchEvent(new Event('crits-basket-change')); } }, onError: () => setErrorText('Your enquiry could not be sent. Please try again or contact us directly.') });
  };
  if (successRef) return <div className="success-panel" role="status" data-testid="status-enquiry-success"><div className="success-icon"><Check size={26} /></div><span className="eyebrow">ENQUIRY RECEIVED</span><h2>Thanks for getting in touch.</h2><p>Your reference is <b>{successRef}</b>. Our team will respond using your preferred contact method.</p><Button href="/" variant="outline">Back to home <ArrowRight size={16} /></Button></div>;
  return <form className="enquiry-form" onSubmit={submit} noValidate>
    <div className="form-heading"><span className="eyebrow">SEND AN ENQUIRY</span><h2>Let’s start a conversation.</h2><p>We’ll use your preferred contact method to follow up.</p></div>
    <div className="form-grid"><label className="field">Your name <input name="name" required maxLength={160} placeholder="Name" data-testid="input-enquiry-name" /></label><label className="field">Organisation <span className="optional">Optional</span><input name="organisation" maxLength={180} placeholder="Company or organisation" data-testid="input-enquiry-organisation" /></label>
      <label className="field">Preferred contact method<select value={contactMethod} onChange={(e) => setContactMethod(e.target.value as typeof contactMethod)} data-testid="select-contact-method"><option value="whatsapp">WhatsApp</option><option value="phone">Telephone</option><option value="email">Email</option></select></label><label className="field">Contact detail<input name="contactValue" required minLength={3} maxLength={254} placeholder={contactMethod === 'email' ? 'you@example.com' : 'Your phone number'} data-testid="input-enquiry-contact" /></label>
      <label className="field full">Location or delivery notes <span className="optional">Optional</span><input name="locationNotes" maxLength={1000} placeholder="Area or any helpful context" data-testid="input-enquiry-location" /></label><label className="field full">How can we help? <span className="optional">Optional</span><textarea name="message" maxLength={3000} rows={4} placeholder="Tell us a little about what you’re looking for." data-testid="input-enquiry-message" /></label></div>
    {errorText && <div className="form-error" role="alert" data-testid="status-enquiry-error">{errorText}</div>}<button className="button button-primary form-submit" type="submit" disabled={create.isPending} data-testid="button-submit-enquiry">{create.isPending ? 'Sending enquiry…' : 'Send enquiry'} {create.isPending ? <span className="tiny-loader" /> : <Send size={16} />}</button><p className="form-privacy">Your information is used to respond to this enquiry. See our <Link href="/privacy">privacy notice</Link>.</p>
  </form>;
}
function Contact() {
  return <Shell><div className="site-width page-wrap page-enter"><div className="breadcrumb"><Link href="/">Home</Link><span>/</span><span>Contact</span></div><div className="contact-layout"><div><PageHeading kicker="WE’RE HERE TO HELP" title="Make your next IT decision with more clarity." copy="Ask about a product, discuss your requirements, or request a quote. Tell us how you’d like us to reach you." /><div className="contact-methods"><a href={`https://wa.me/256${whatsapp.replace(/\D/g, '').slice(1)}`} className="contact-method" data-testid="link-whatsapp-contact"><span className="contact-icon"><MessageCircle /></span><span><b>WhatsApp</b><small>{whatsapp}</small></span><ArrowUpRight size={17} /></a><a href={`tel:+256200901530`} className="contact-method"><span className="contact-icon"><Phone /></span><span><b>Telephone</b><small>{phoneMain} · 0414 670 451 · 0393 243 318</small></span><ArrowUpRight size={17} /></a><a href={`mailto:${email}`} className="contact-method"><span className="contact-icon"><Mail /></span><span><b>Email</b><small>{email}</small></span><ArrowUpRight size={17} /></a></div></div><ContactForm /></div></div></Shell>;
}
function Basket() {
  const [lines, setLines] = useState(getBasket);
  const update = (next: BasketLine[]) => { setLines(next); saveBasket(next); window.dispatchEvent(new Event('crits-basket-change')); };
  return <Shell><div className="site-width page-wrap page-enter"><div className="breadcrumb"><Link href="/">Home</Link><span>/</span><span>Enquiry basket</span></div><PageHeading kicker="YOUR SHORTLIST" title="Enquiry basket." copy="Collect products you’d like to ask us about, then send them in one enquiry. This is not a checkout." />
    <div className="basket-layout"><div className="basket-list">{lines.length ? lines.map(({ product, quantity }) => <article className="basket-item" key={product.id} data-testid={`row-basket-product-${product.id}`}><div className="basket-thumb">{product.imageUrls[0] ? <img src={product.imageUrls[0]} alt="" /> : <Package />}</div><div className="basket-info"><span className="eyebrow">{product.categoryName}</span><Link href={`/products/${product.slug}`}><b>{product.title}</b></Link><small>{money(product.priceUgx)}</small></div><div className="quantity-control"><button aria-label="Decrease quantity" onClick={() => update(lines.map((l) => l.product.id === product.id ? { ...l, quantity: Math.max(1, quantity - 1) } : l))}>−</button><span>{quantity}</span><button aria-label="Increase quantity" onClick={() => update(lines.map((l) => l.product.id === product.id ? { ...l, quantity: Math.min(100, quantity + 1) } : l))}>+</button></div><button className="remove-button" aria-label={`Remove ${product.title}`} onClick={() => update(lines.filter((l) => l.product.id !== product.id))} data-testid={`button-remove-${product.id}`}><X size={17} /></button></article>) : <div className="basket-empty"><div className="empty-mark"><ShoppingBasket size={28} /></div><div><h3>Your enquiry basket is empty.</h3><p>Browse the catalogue and add products you’d like to discuss.</p><Button href="/catalog" variant="outline">Explore catalogue <ArrowRight size={15} /></Button></div></div>}</div>{lines.length > 0 && <aside className="basket-summary"><span className="eyebrow">NEXT STEP</span><h2>Ready to ask?</h2><p>Send the items above with your contact details. A CRITS team member will follow up.</p><a href="#enquiry-form" className="button button-orange" data-testid="link-basket-enquiry">Continue to enquiry <ArrowDownToLine size={16} /></a><div className="summary-note"><ShieldCheck size={18} /><span>No payment details needed.<br />This is a quote enquiry only.</span></div></aside>}</div>
    {lines.length > 0 && <div id="enquiry-form" className="basket-form"><ContactForm initialLines={lines} /></div>}
  </div></Shell>;
}
function About() {
  return <Shell><div className="site-width page-wrap page-enter"><div className="breadcrumb"><Link href="/">Home</Link><span>/</span><span>About</span></div><PageHeading kicker="ABOUT CRITS LIMITED" title="Quality, redefined." copy="A clear, considered way to explore technology and business IT products." /><div className="story-grid"><div className="story-art"><div className="story-corner">CRITS<br /><span>LIMITED</span></div><div className="story-copy-art">Technology<br />for real work.</div><div className="story-rule" /></div><div className="story-text"><span className="eyebrow">THE WAY WE WORK</span><h2>Good decisions start with good information.</h2><p>CRITS Limited brings customers and technology products together through an enquiry-first experience. Explore product information, make a shortlist, and speak with our team about what fits your requirements.</p><p>Product listings are added and reviewed by staff. We don’t publish a product until its details have been approved for the catalogue.</p><Button href="/catalog" variant="outline">Explore the catalogue <ArrowRight size={16} /></Button></div></div><section className="principles"><div><span>01</span><ShieldCheck /><h3>Clear product details</h3><p>Listings show the information approved for sharing, with questions welcomed.</p></div><div><span>02</span><Users /><h3>People in the loop</h3><p>Enquiries go to CRITS staff, not an anonymous checkout flow.</p></div><div><span>03</span><CheckCircle2 /><h3>Reviewed before release</h3><p>The public catalogue begins empty and grows as staff approve listings.</p></div></section></div><ContactBand /></Shell>;
}
function Services() {
  const services = [
    ['01', 'Business technology sourcing', 'Tell us the job to be done. We can discuss suitable technology options and help you request a quote.', BriefcaseBusiness],
    ['02', 'IT equipment supply', 'Browse approved catalogue listings or ask our team about products that match your requirements.', HardDrive],
    ['03', 'Business IT guidance', 'Share your use case, environment and priorities so our team can understand what you need.', Headset],
    ['04', 'Quote enquiries', 'Build an enquiry basket or send a message directly. We’ll follow up using your preferred contact method.', ClipboardList],
  ] as const;
  return <Shell><div className="site-width page-wrap page-enter"><div className="breadcrumb"><Link href="/">Home</Link><span>/</span><span>Services</span></div><PageHeading kicker="WHAT WE DO" title="Technology support for the way you work." copy="Start with a product question or a business need. We’ll help you take the next step." /><div className="services-list">{services.map(([num, title, copy, Icon]) => <article className="service-row" key={num as string}><span className="service-num">{num as string}</span><Icon className="service-icon" /><div><h2>{title as string}</h2><p>{copy as string}</p></div><ArrowUpRight size={19} /></article>)}</div><div className="service-note"><LockKeyhole /><p><b>No checkout or payment collection.</b> This website is for browsing products and sending an enquiry to CRITS staff.</p></div></div><ContactBand /></Shell>;
}
function Privacy() {
  return <Shell><div className="site-width page-wrap narrow-page page-enter"><div className="breadcrumb"><Link href="/">Home</Link><span>/</span><span>Privacy</span></div><PageHeading kicker="YOUR INFORMATION" title="Privacy notice." copy="How information submitted through this website is used." /><div className="legal-copy"><h2>Information you provide</h2><p>When you send an enquiry, we collect the details you enter, including your name, chosen contact method and contact detail, and any optional organisation, location or message information.</p><h2>How we use it</h2><p>CRITS Limited uses enquiry information to understand and respond to your request, including questions about products and quote enquiries. Enquiry basket items are included with your submission so we can respond with relevant context.</p><h2>Contact preference</h2><p>We use the contact method you select to follow up. Please provide contact details you are comfortable using for this purpose.</p><h2>Catalogue activity</h2><p>Product views and catalogue searches may be recorded to help staff understand how the catalogue is being used. This activity does not publish your contact information.</p><h2>Questions</h2><p>For a privacy question, contact us at <a href={`mailto:${email}`}>{email}</a> or call {phoneMain}.</p><p className="legal-note">This notice describes the enquiry features available on this website. It is not legal advice.</p></div></div></Shell>;
}
const clerkAppearance = {
  theme: shadcn,
  cssLayerName: 'clerk',
  options: {
    logoPlacement: 'inside' as const,
    logoLinkUrl: basePath || '/',
    logoImageUrl: `${window.location.origin}${basePath}/logo.svg`,
    socialButtonsPlacement: 'top' as const,
    socialButtonsVariant: 'blockButton' as const,
  },
  variables: {
    colorPrimary: '#174f92',
    colorForeground: '#1d3045',
    colorMutedForeground: '#63768a',
    colorDanger: '#b42318',
    colorBackground: '#fbfaf7',
    colorInput: '#ffffff',
    colorInputForeground: '#243f59',
    colorNeutral: '#dce2e7',
    fontFamily: 'Inter, sans-serif',
    borderRadius: '8px',
  },
  elements: {
    rootBox: 'w-full flex justify-center',
    cardBox: 'bg-[#fbfaf7] rounded-xl w-[440px] max-w-full overflow-hidden border border-[#dce2e7] shadow-[0_18px_48px_rgba(22,56,83,0.10)]',
    card: '!shadow-none !border-0 !bg-transparent !rounded-none',
    footer: '!shadow-none !border-0 !bg-transparent !rounded-none',
    headerTitle: 'text-[#1d3045] font-semibold',
    headerSubtitle: 'text-[#63768a]',
    socialButtonsBlockButtonText: 'text-[#264763] font-medium',
    formFieldLabel: 'text-[#304b64] font-medium',
    footerActionLink: 'text-[#174f92] font-semibold',
    footerActionText: 'text-[#63768a]',
    dividerText: 'text-[#718294]',
    identityPreviewEditButton: 'text-[#174f92]',
    formFieldSuccessText: 'text-[#36734c]',
    alertText: 'text-[#8d2f24]',
    logoBox: 'mb-3',
    logoImage: 'max-h-10',
    socialButtonsBlockButton: 'bg-white border border-[#dce2e7] hover:bg-[#f1f4f6]',
    formButtonPrimary: 'bg-[#174f92] text-white hover:bg-[#123e76]',
    formFieldInput: 'bg-white text-[#1d3045] border-[#dce2e7]',
    footerAction: 'text-[#63768a]',
    dividerLine: 'bg-[#dce2e7]',
    alert: 'bg-[#fff1ed] border border-[#f2c9be]',
    otpCodeFieldInput: 'bg-white text-[#1d3045] border-[#dce2e7]',
    formFieldRow: 'text-[#304b64]',
    main: 'text-[#1d3045]',
  },
};

function SignInPage() {
  return <main className="clerk-auth-page"><div className="auth-brand-panel"><Brand inverse /><div className="auth-panel-content"><span className="eyebrow">CRITS LIMITED · STAFF ACCESS</span><h1>Better business<br />starts with <em>clarity.</em></h1><p>Secure staff access for maintaining the CRITS product catalogue and responding to customer enquiries.</p><div className="auth-panel-foot"><ShieldCheck /> Staff access is managed through CRITS-approved accounts.</div></div></div><section className="clerk-form-area"><Link href="/" className="auth-back"><ArrowLeft size={15} /> Return to CRITS website</Link><SignIn routing="path" path={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`} forceRedirectUrl={`${basePath}/admin`} /><span className="auth-legal">CRITS Limited · Staff workspace</span></section></main>;
}

function SignUpPage() {
  return <main className="clerk-auth-page"><div className="auth-brand-panel"><Brand inverse /><div className="auth-panel-content"><span className="eyebrow">CRITS LIMITED · STAFF ACCESS</span><h1>Better business<br />starts with <em>clarity.</em></h1><p>Create an account to request access to the CRITS staff workspace. Dashboard permissions are verified separately by CRITS.</p><div className="auth-panel-foot"><ShieldCheck /> Account creation does not grant staff authorization.</div></div></div><section className="clerk-form-area"><Link href="/" className="auth-back"><ArrowLeft size={15} /> Return to CRITS website</Link><SignUp routing="path" path={`${basePath}/sign-up`} signInUrl={`${basePath}/sign-in`} forceRedirectUrl={`${basePath}/admin`} /><span className="auth-legal">CRITS Limited · Staff workspace</span></section></main>;
}

function ClerkQueryClientCacheInvalidator() {
  const { addListener } = useClerk();
  const client = useQueryClient();
  const prevUserIdRef = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    const unsubscribe = addListener(({ user }) => {
      const userId = user?.id ?? null;
      if (prevUserIdRef.current !== undefined && prevUserIdRef.current !== userId) client.clear();
      prevUserIdRef.current = userId;
    });
    return unsubscribe;
  }, [addListener, client]);
  return null;
}
function Admin() {
  const [tab, setTab] = useState<'overview' | 'products' | 'categories' | 'enquiries' | 'data' | 'settings'>('overview');
  const [productForm, setProductForm] = useState(false);
  const [categoryForm, setCategoryForm] = useState(false);
  const [message, setMessage] = useState('');
  const [uploadedUrls, setUploadedUrls] = useState<string[]>([]);
  const [retentionDays, setRetentionDays] = useState('');
  const [retentionDisabled, setRetentionDisabled] = useState(true);
  const [retentionConfirmed, setRetentionConfirmed] = useState(false);
  const [settingsInitialized, setSettingsInitialized] = useState(false);
  const queryClient = useQueryClient();
  const access = useCheckAdminAccess({ query: { queryKey: getCheckAdminAccessQueryKey() } });
  const allowed = !!access.data?.allowed;
  const overview = useGetAdminOverview({ query: { enabled: allowed, queryKey: getGetAdminOverviewQueryKey() } });
  const adminProducts = useListAdminProducts(undefined, { query: { enabled: allowed, queryKey: getListAdminProductsQueryKey() } });
  const adminCategories = useListAdminCategories({ query: { enabled: allowed, queryKey: getListAdminCategoriesQueryKey() } });
  const adminEnquiries = useListAdminEnquiries(undefined, { query: { enabled: allowed, queryKey: getListAdminEnquiriesQueryKey() } });
  const adminSettings = useGetAdminSettings({ query: { enabled: allowed, queryKey: getGetAdminSettingsQueryKey() } });
  const createProduct = useCreateAdminProduct();
  const updateProduct = useUpdateAdminProduct();
  const importProducts = useImportAdminProducts();
  const createCategory = useCreateAdminCategory();
  const updateCategory = useUpdateAdminCategory();
  const updateEnquiry = useUpdateAdminEnquiry();
  const updateSettings = useUpdateAdminSettings();
  const uploadImage = useRequestProductImageUpload();
  const refreshAdmin = () => Promise.all([
    queryClient.invalidateQueries({ queryKey: getGetAdminOverviewQueryKey() }),
    queryClient.invalidateQueries({ queryKey: getListAdminProductsQueryKey() }),
    queryClient.invalidateQueries({ queryKey: getListAdminCategoriesQueryKey() }),
    queryClient.invalidateQueries({ queryKey: getListAdminEnquiriesQueryKey() }),
    queryClient.invalidateQueries({ queryKey: getGetAdminSettingsQueryKey() }),
    queryClient.invalidateQueries({ queryKey: getListCategoriesQueryKey() }),
    queryClient.invalidateQueries({ queryKey: getListProductsQueryKey() }),
  ]);
  useEffect(() => {
    if (!adminSettings.data || settingsInitialized) return;
    const days = adminSettings.data.enquiryRetentionDays;
    setRetentionDisabled(days === null);
    setRetentionDays(days === null ? '' : String(days));
    setSettingsInitialized(true);
  }, [adminSettings.data, settingsInitialized]);
  useEffect(() => { if (access.isError) setMessage('Sign in with a CRITS staff account to access the workspace.'); }, [access.isError]);
  if (access.isLoading) return <main className="admin-gate"><div className="admin-gate-card"><div className="skeleton-line" /><div className="skeleton-line short" /><span className="eyebrow">CHECKING STAFF ACCESS</span></div></main>;
  if (access.isError) return <main className="admin-gate"><div className="admin-gate-card"><Brand /><span className="eyebrow">STAFF WORKSPACE</span><h1>Sign in to continue.</h1><p>Staff access uses secure CRITS-approved accounts.</p><Button href="/sign-in" variant="primary">Continue to sign in <ArrowRight size={16} /></Button><small>The session may need a moment to load. <button className="text-button" onClick={() => access.refetch()}>Check again</button></small></div></main>;
  if (!allowed) return <main className="admin-gate"><div className="admin-gate-card"><Brand /><div className="denied-mark"><LockKeyhole /></div><span className="eyebrow">ACCESS RESTRICTED</span><h1>This area is for CRITS staff.</h1><p>Your account is signed in, but it isn’t on the staff access list. Contact an administrator if you believe this is a mistake.</p><Button href="/" variant="outline">Return to public website <ArrowRight size={16} /></Button><small data-testid="status-admin-denied">Signed in · staff access not authorized</small></div></main>;
  const createProductSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault(); const form = new FormData(e.currentTarget);
    const categoryId = Number(form.get('categoryId'));
    const specEntries = String(form.get('specifications') || '').split('\n').map((row) => row.split(':')).filter((r) => r.length > 1);
    const input: ProductInput = {
      title: String(form.get('title')).trim(), slug: slugify(String(form.get('title'))), brand: String(form.get('brand') || '').trim() || null, model: String(form.get('model') || '').trim() || null,
      categoryId, condition: String(form.get('condition')) as ProductInput['condition'], description: String(form.get('description') || '').trim(),
      specifications: Object.fromEntries(specEntries.map((r) => [r[0].trim(), r.slice(1).join(':').trim()])), imageUrls: [...uploadedUrls, ...String(form.get('images') || '').split('\n').map((x) => x.trim()).filter(Boolean)].slice(0, 12),
      priceUgx: String(form.get('price') || '').trim() ? Number(form.get('price')) : null, availability: String(form.get('availability')) as ProductInput['availability'],
      stockQuantity: String(form.get('stock') || '').trim() ? Number(form.get('stock')) : null, sku: String(form.get('sku') || '').trim() || null,
      sourceListingUrl: String(form.get('source') || '').trim() || null, status: String(form.get('status')) as ProductInput['status'], featured: form.get('featured') === 'on',
    };
    createProduct.mutate({ data: input }, { onSuccess: () => { setProductForm(false); setMessage('Product saved.'); void refreshAdmin(); }, onError: () => setMessage('Product could not be saved. Review the required fields and try again.') });
  };
  const uploadProductImage = async (file?: File) => {
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { setMessage('Image must be 10 MB or smaller.'); return; }
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) { setMessage('Choose a JPG, PNG or WEBP image.'); return; }
    try {
      const requested = await uploadImage.mutateAsync({ data: { name: file.name, size: file.size, contentType: file.type as 'image/jpeg' | 'image/png' | 'image/webp' } });
      const response = await fetch(requested.uploadURL, { method: 'PUT', headers: { 'Content-Type': file.type }, body: file });
      if (!response.ok) throw new Error('Upload failed');
      setUploadedUrls((current) => [...current, requested.imageUrl].slice(0, 12));
      setMessage('Product image uploaded and ready to save.');
    } catch { setMessage('Image upload failed. You can add a hosted image URL instead.'); }
  };
  const importCsv = async (file?: File) => {
    if (!file) return;
    try {
      const text = await file.text(); const rows = text.trim().split(/\r?\n/);
      const headers = rows[0].split(',').map((v) => v.trim());
      const parse = (line: string) => line.split(',').map((v) => v.trim().replace(/^"|"$/g, ''));
      const imported: ProductInput[] = rows.slice(1).filter(Boolean).map((line) => {
        const values = parse(line); const row = Object.fromEntries(headers.map((h, i) => [h, values[i] || '']));
        return { title: row.title || '', slug: row.slug || slugify(row.title || ''), brand: row.brand || null, model: row.model || null, categoryId: Number(row.categoryId), condition: (row.condition || 'new') as ProductInput['condition'], description: row.description || '', specifications: {}, imageUrls: row.imageUrls ? row.imageUrls.split('|') : [], priceUgx: row.priceUgx ? Number(row.priceUgx) : null, availability: (row.availability || 'quote') as ProductInput['availability'], stockQuantity: row.stockQuantity ? Number(row.stockQuantity) : null, sku: row.sku || null, sourceListingUrl: row.sourceListingUrl || null, status: (row.status || 'draft') as ProductInput['status'], featured: false };
      });
      if (!imported.length || imported.some((p) => !p.title || !p.categoryId)) { setMessage('Import needs at least one product with a title and valid categoryId.'); return; }
      importProducts.mutate({ data: { products: imported } }, { onSuccess: (r) => { setMessage(`${r.imported} product records imported.`); void refreshAdmin(); }, onError: () => setMessage('Import failed. Check that your CSV matches the template and uses valid categories.') });
    } catch { setMessage('Unable to read this CSV file.'); }
  };
  const exportCsv = () => {
    const records = adminProducts.data || [];
    const cols = ['title', 'slug', 'brand', 'model', 'categoryId', 'condition', 'description', 'priceUgx', 'availability', 'stockQuantity', 'sku', 'sourceListingUrl', 'status'];
    const csv = [cols.join(','), ...records.map((p) => cols.map((key) => `"${String((p as unknown as Record<string, unknown>)[key] ?? '').replaceAll('"', '""')}"`).join(','))].join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })); const a = document.createElement('a'); a.href = url; a.download = 'crits-catalogue.csv'; a.click(); URL.revokeObjectURL(url);
  };
  const saveRetentionSettings = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!adminSettings.data) return;
    const nextDays = retentionDisabled ? null : Number(retentionDays);
    if (nextDays !== null && (!Number.isInteger(nextDays) || nextDays < 1 || nextDays > 3650)) {
      setMessage('Enter a whole number of days from 1 to 3650, or choose no automatic deletion.');
      return;
    }
    const changed = nextDays !== adminSettings.data.enquiryRetentionDays;
    if (changed && !retentionConfirmed) {
      setMessage('Please confirm that you understand the retention change may permanently delete older enquiry records.');
      return;
    }
    updateSettings.mutate({ data: { enquiryRetentionDays: nextDays } }, {
      onSuccess: (settings) => {
        queryClient.setQueryData(getGetAdminSettingsQueryKey(), settings);
        setRetentionConfirmed(false);
        setMessage('Privacy retention setting saved.');
        void queryClient.invalidateQueries({ queryKey: getGetAdminSettingsQueryKey() });
      },
      onError: () => setMessage('The retention setting could not be saved. Please try again.'),
    });
  };
  const tabs: { id: typeof tab; name: string; icon: typeof LayoutDashboard }[] = [{ id: 'overview', name: 'Overview', icon: LayoutDashboard }, { id: 'products', name: 'Products', icon: Package }, { id: 'categories', name: 'Categories', icon: Tag }, { id: 'enquiries', name: 'Enquiries', icon: MessageCircle }, { id: 'data', name: 'Import / export', icon: FileText }, { id: 'settings', name: 'Privacy settings', icon: LockKeyhole }];
  return <main className="admin-layout">
    <aside className="admin-sidebar"><Brand inverse /><div className="admin-brand-caption">STAFF WORKSPACE</div><div className="admin-side-label">MANAGE</div><nav>{tabs.map(({ id, name, icon: Icon }) => <button key={id} onClick={() => { setTab(id); setMessage(''); }} className={tab === id ? 'selected' : ''} data-testid={`button-admin-tab-${id}`}><Icon size={18} />{name}{id === 'enquiries' && !!overview.data?.openEnquiryCount && <span className="side-count">{overview.data.openEnquiryCount}</span>}</button>)}</nav><div className="admin-sidebar-bottom"><Link href="/" data-testid="link-admin-public"><ArrowLeft size={15} /> Public website</Link><span><ShieldCheck size={16} /> Restricted staff access</span></div></aside>
    <section className="admin-main"><header className="admin-topbar"><div><span className="admin-mobile-brand">CRITS / </span><span>Staff workspace</span><span className="admin-divider">/</span><b>{tabs.find((x) => x.id === tab)?.name}</b></div><Link href="/" className="admin-view-site">View public site <ArrowUpRight size={15} /></Link></header><div className="admin-content">
      {message && <div className="admin-flash" role="status" data-testid="status-admin-message"><CheckCircle2 size={17} />{message}<button onClick={() => setMessage('')} aria-label="Dismiss message"><X size={16} /></button></div>}
      {tab === 'overview' && <><div className="admin-title-row"><div><span className="eyebrow">CRITS LIMITED · OPERATIONS</span><h1>Good day. Here’s the overview.</h1><p>Catalogue and customer activity at a glance.</p></div></div>{overview.isLoading ? <div className="metric-grid">{[1, 2, 3, 4].map((n) => <div className="metric-card" key={n}><div className="skeleton-line short" /><div className="skeleton-line" /></div>)}</div> : overview.isError ? <QueryFailure retry={() => overview.refetch()} /> : overview.data && <><div className="metric-grid">{[{ label: 'Product records', value: overview.data.productCount, icon: Package }, { label: 'Published', value: overview.data.publishedCount, icon: BadgeCheck }, { label: 'Total enquiries', value: overview.data.enquiryCount, icon: MessageCircle }, { label: 'Open enquiries', value: overview.data.openEnquiryCount, icon: Clock3 }, { label: 'Product views', value: overview.data.productViews, icon: ArrowUpRight }, { label: 'Catalogue searches', value: overview.data.searches, icon: Search }].map(({ label, value, icon: Icon }) => <div className="metric-card" key={label}><div><span>{label}</span><Icon size={18} /></div><strong data-testid={`text-metric-${slugify(label)}`}>{value}</strong></div>)}</div><div className="admin-dashboard-grid"><section className="admin-panel"><div className="panel-title"><div><span className="eyebrow">CUSTOMER ACTIVITY</span><h2>Recent enquiries</h2></div><button className="text-button" onClick={() => setTab('enquiries')}>View all <ArrowRight size={14} /></button></div>{overview.data.recentEnquiries.length ? overview.data.recentEnquiries.map((enq) => <EnquirySummary key={enq.id} enquiry={enq} />) : <AdminEmpty icon={MessageCircle} title="No enquiries yet" copy="New product and contact enquiries will appear here." />}</section><section className="admin-panel"><div className="panel-title"><div><span className="eyebrow">CATALOGUE ACTIVITY</span><h2>Most viewed listings</h2></div><button className="text-button" onClick={() => setTab('products')}>Manage products <ArrowRight size={14} /></button></div>{overview.data.topProducts.length ? overview.data.topProducts.map((p) => <div className="top-product" key={p.id}><div className="mini-product-img">{p.imageUrls[0] ? <img src={p.imageUrls[0]} alt="" /> : <Package size={17} />}</div><div><b>{p.title}</b><small>{p.categoryName}</small></div><span>{p.viewCount} views</span></div>) : <AdminEmpty icon={Package} title="No product activity" copy="Published products and their views will appear here." />}</section></div></>}</>}
      {tab === 'products' && <><div className="admin-title-row"><div><span className="eyebrow">CATALOGUE MANAGEMENT</span><h1>Products</h1><p>Maintain approved product information and publication status.</p></div><button className="button button-primary" onClick={() => setProductForm(!productForm)} data-testid="button-create-product"><Plus size={16} /> Add product</button></div>
        {productForm && <form className="admin-form-card" onSubmit={createProductSubmit}><div className="panel-title"><div><h2>Add catalogue product</h2><p>Only add products approved for publication.</p></div><button type="button" className="icon-button" onClick={() => setProductForm(false)} aria-label="Close form"><X size={18} /></button></div><div className="admin-form-grid"><label>Product title<input name="title" required maxLength={220} data-testid="input-admin-product-title" /></label><label>Category<select name="categoryId" required defaultValue=""><option value="" disabled>Select category</option>{adminCategories.data?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label><label>Brand<input name="brand" /></label><label>Model<input name="model" /></label><label>Condition<select name="condition"><option value="new">New</option><option value="used">Used</option><option value="refurbished">Refurbished</option></select></label><label>Availability<select name="availability"><option value="quote">Quote required</option><option value="available">Available</option><option value="out_of_stock">Out of stock</option></select></label><label>Price (UGX)<input name="price" type="number" min="0" /></label><label>Stock quantity<input name="stock" type="number" min="0" /></label><label>SKU<input name="sku" /></label><label>Source listing URL<input name="source" type="url" /></label><label className="wide">Description<textarea name="description" rows={3} /></label><label className="wide">Specifications <small>One per line: Key: value</small><textarea name="specifications" rows={3} placeholder={'Memory: 16 GB\\nStorage: 512 GB'} /></label><label className="wide">Image URLs <small>One URL per line · uploaded images: {uploadedUrls.length}</small><textarea name="images" rows={2} /></label><label className="wide image-upload-label">Upload product image <input type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => void uploadProductImage(e.target.files?.[0])} data-testid="input-product-image-upload" /><small>{uploadImage.isPending ? 'Preparing secure upload…' : 'JPEG, PNG or WEBP · up to 10 MB'}</small></label><label>Publication status<select name="status"><option value="draft">Draft</option><option value="published">Published</option><option value="archived">Archived</option></select></label><label className="check-field"><input type="checkbox" name="featured" /> Feature on public home</label></div><button className="button button-primary" type="submit" disabled={createProduct.isPending}>{createProduct.isPending ? 'Saving…' : 'Save product'} <Check size={15} /></button></form>}
        <div className="admin-panel table-panel"><div className="panel-title"><div><span className="eyebrow">ALL RECORDS</span><h2>Catalogue</h2></div><Button onClick={exportCsv} variant="outline"><ArrowDownToLine size={15} /> Export CSV</Button></div>{adminProducts.isLoading ? <div className="skeleton-table" /> : adminProducts.isError ? <QueryFailure retry={() => adminProducts.refetch()} /> : adminProducts.data?.length ? <div className="table-scroll"><table><thead><tr><th>Product</th><th>Category</th><th>Condition</th><th>Status</th><th>Availability</th><th>Action</th></tr></thead><tbody>{adminProducts.data.map((p) => <tr key={p.id} data-testid={`row-admin-product-${p.id}`}><td><b>{p.title}</b><small>{p.brand || p.model || p.sku || '—'}</small></td><td>{p.categoryName}</td><td>{human(p.condition)}</td><td><StatusPill value={p.status} /></td><td>{human(p.availability)}</td><td><button className="small-action" onClick={() => updateProduct.mutate({ id: p.id, data: { status: p.status === 'published' ? 'draft' : 'published' } }, { onSuccess: () => { setMessage('Product status updated.'); void refreshAdmin(); }, onError: () => setMessage('Unable to update product status.') })} data-testid={`button-toggle-product-${p.id}`}>{p.status === 'published' ? 'Unpublish' : 'Publish'}</button></td></tr>)}</tbody></table></div> : <AdminEmpty icon={Package} title="No product records yet" copy="Create an approved product record to begin building the catalogue." action={<button className="text-button" onClick={() => setProductForm(true)}>Add a product <Plus size={15} /></button>} />}</div>
      </>}
      {tab === 'categories' && <><div className="admin-title-row"><div><span className="eyebrow">CATALOGUE ORGANISATION</span><h1>Categories</h1><p>Keep product groups useful and easy to browse.</p></div><button className="button button-primary" onClick={() => setCategoryForm(!categoryForm)} data-testid="button-create-category"><Plus size={16} /> Add category</button></div>{categoryForm && <CategoryForm pending={createCategory.isPending} onCancel={() => setCategoryForm(false)} onSubmit={(data) => createCategory.mutate({ data }, { onSuccess: () => { setCategoryForm(false); setMessage('Category created.'); void refreshAdmin(); }, onError: () => setMessage('Category could not be created. Check the name and slug.') })} />}{adminCategories.isLoading ? <div className="skeleton-table" /> : adminCategories.isError ? <QueryFailure retry={() => adminCategories.refetch()} /> : adminCategories.data?.length ? <div className="category-admin-list">{adminCategories.data.map((c) => <div className="category-admin-row" key={c.id} data-testid={`row-admin-category-${c.id}`}><div className="category-admin-icon"><Tag /></div><div className="category-admin-info"><b>{c.name}</b><span>/{c.slug} · {c.productCount} products</span><small>{c.description || 'No description'}</small></div><StatusPill value={c.active ? 'active' : 'inactive'} /><button className="small-action" onClick={() => updateCategory.mutate({ id: c.id, data: { active: !c.active } }, { onSuccess: () => { setMessage(`Category ${c.active ? 'deactivated' : 'activated'}.`); void refreshAdmin(); }, onError: () => setMessage('Unable to update category.') })} data-testid={`button-toggle-category-${c.id}`}>{c.active ? 'Deactivate' : 'Activate'}</button></div>)}</div> : <AdminEmpty icon={Tag} title="No categories yet" copy="Add categories before creating product records." action={<button className="text-button" onClick={() => setCategoryForm(true)}>Create category <Plus size={15} /></button>} />}</>}
      {tab === 'enquiries' && <><div className="admin-title-row"><div><span className="eyebrow">CUSTOMER MESSAGES</span><h1>Enquiries</h1><p>Review quote requests and keep each response moving.</p></div></div>{adminEnquiries.isLoading ? <div className="skeleton-table" /> : adminEnquiries.isError ? <QueryFailure retry={() => adminEnquiries.refetch()} /> : adminEnquiries.data?.length ? <div className="enquiry-admin-list">{adminEnquiries.data.map((e) => <EnquiryAdminCard key={e.id} enquiry={e} onUpdate={(data) => updateEnquiry.mutate({ id: e.id, data }, { onSuccess: () => { setMessage(`Enquiry ${e.reference} updated.`); void refreshAdmin(); }, onError: () => setMessage('Enquiry update failed.') })} pending={updateEnquiry.isPending} />)}</div> : <AdminEmpty icon={MessageCircle} title="No enquiries received yet" copy="Customer product and contact requests will appear here." />}</>}
      {tab === 'data' && <><div className="admin-title-row"><div><span className="eyebrow">CATALOGUE DATA</span><h1>Import & export</h1><p>Move product information in or out of the CRITS catalogue.</p></div></div><div className="data-tools"><section className="data-tool-card"><div className="tool-icon"><Upload /></div><span className="eyebrow">BATCH IMPORT</span><h2>Import product CSV</h2><p>Each row should contain title and categoryId. Other supported columns include slug, brand, model, condition, description, priceUgx, availability, stockQuantity, sku, sourceListingUrl and status.</p><label className="file-picker"><input type="file" accept=".csv,text/csv" onChange={(e) => void importCsv(e.target.files?.[0])} data-testid="input-import-csv" /><Upload size={16} /> Choose CSV file</label>{importProducts.isPending && <p className="pending-note">Validating and importing…</p>}</section><section className="data-tool-card"><div className="tool-icon"><ArrowDownToLine /></div><span className="eyebrow">BACKUP / REVIEW</span><h2>Export catalogue CSV</h2><p>Download the current staff catalogue records to review or keep a copy. Product specifications and image URLs are managed separately.</p><Button onClick={exportCsv} variant="outline" disabled={!adminProducts.data?.length}><ArrowDownToLine size={16} /> Download CSV</Button></section></div><div className="admin-note"><ShieldCheck /><p><b>Keep source details accurate.</b> Only import product information approved by CRITS staff. Imported records are reviewed before publication.</p></div></>}
      {tab === 'settings' && <><div className="admin-title-row"><div><span className="eyebrow">PRIVACY CONTROLS</span><h1>Enquiry retention</h1><p>Configure how long customer enquiry records are retained.</p></div></div>
        {adminSettings.isLoading ? <div className="admin-panel"><div className="skeleton-line" /><div className="skeleton-line short" /></div> : adminSettings.isError ? <QueryFailure retry={() => adminSettings.refetch()} /> : adminSettings.data && <div className="retention-layout"><form className="retention-panel" onSubmit={saveRetentionSettings}>
          <div className="retention-panel-heading"><span className="retention-icon"><LockKeyhole /></span><div><span className="eyebrow">ENQUIRY RECORDS</span><h2>Automatic deletion</h2><p>Choose a retention period for enquiries submitted through the website.</p></div></div>
          <label className="retention-toggle"><input type="checkbox" checked={retentionDisabled} onChange={(e) => { setRetentionDisabled(e.target.checked); setRetentionConfirmed(false); if (e.target.checked) setRetentionDays(''); }} data-testid="checkbox-retention-disabled" /><span><b>Disable automatic deletion</b><small>No retention period is set. Enquiry records are not automatically deleted.</small></span></label>
          <label className="retention-days-field">Retention period in days<input type="number" min={1} max={3650} step={1} value={retentionDays} disabled={retentionDisabled} onChange={(e) => { setRetentionDays(e.target.value); setRetentionConfirmed(false); }} placeholder="Enter days (1–3650)" data-testid="input-retention-days" /></label>
          <div className="retention-warning" role="note"><CircleHelp /><div><b>Important: this setting can permanently delete enquiry records.</b><p>When a retention period is set, older enquiries may be permanently removed. Confirm the period is appropriate before saving.</p></div></div>
          <label className="retention-confirm"><input type="checkbox" checked={retentionConfirmed} onChange={(e) => setRetentionConfirmed(e.target.checked)} data-testid="checkbox-retention-confirm" /><span>I understand changing this setting may permanently delete older enquiry records.</span></label>
          <div className="retention-actions"><span>{adminSettings.data.updatedAt ? `Last updated ${new Date(adminSettings.data.updatedAt).toLocaleString()}` : 'No previous update recorded'}</span><button className="button button-primary" type="submit" disabled={updateSettings.isPending || !retentionConfirmed} data-testid="button-save-retention">{updateSettings.isPending ? 'Saving setting…' : 'Confirm & save'} <Check size={15} /></button></div>
        </form><aside className="retention-side"><div className="launch-checklist"><span className="eyebrow">LAUNCH CHECKLIST</span><h2>Before choosing a retention period</h2><div><CheckCircle2 /><p><b>Confirm local privacy rules.</b><br />Check the applicable privacy requirements and retention obligations before enabling automatic deletion.</p></div><p>CRITS should select a period that matches its approved privacy policy and operational needs.</p></div><div className="admin-note"><ShieldCheck /><p><b>Current setting</b><br />{adminSettings.data.enquiryRetentionDays == null ? 'No automatic deletion — retention is unset.' : `${adminSettings.data.enquiryRetentionDays} days`}</p></div></aside></div>}
      </>}
    </div></section>
  </main>;
}
function CategoryForm({ pending, onCancel, onSubmit }: { pending: boolean; onCancel: () => void; onSubmit: (data: { name: string; slug: string; description: string; active: boolean }) => void }) {
  const [name, setName] = useState(''); const [description, setDescription] = useState('');
  return <form className="category-create-form" onSubmit={(e) => { e.preventDefault(); onSubmit({ name: name.trim(), slug: slugify(name), description: description.trim(), active: true }); }}><label>Category name<input required value={name} onChange={(e) => setName(e.target.value)} data-testid="input-category-name" /></label><label>Description<input value={description} onChange={(e) => setDescription(e.target.value)} /></label><button className="button button-primary" disabled={pending || !name.trim()}>{pending ? 'Saving…' : 'Create category'}</button><button type="button" className="text-button" onClick={onCancel}>Cancel</button></form>;
}
function StatusPill({ value }: { value: string }) { return <span className={`status-pill status-${value}`} data-testid={`status-pill-${value}`}>{human(value)}</span>; }
function AdminEmpty({ icon: Icon, title, copy, action }: { icon: typeof Package; title: string; copy: string; action?: ReactNode }) {
  return <div className="admin-empty"><div className="admin-empty-icon"><Icon size={22} /></div><b>{title}</b><p>{copy}</p>{action}</div>;
}
function EnquirySummary({ enquiry }: { enquiry: AdminEnquiry }) {
  return <div className="recent-enquiry" data-testid={`row-recent-enquiry-${enquiry.id}`}><div className="enquiry-avatar">{enquiry.name.trim().split(/\s+/).slice(0, 2).map((x) => x[0]).join('').toUpperCase()}</div><div><b>{enquiry.name}</b><small>{enquiry.reference} · {new Date(enquiry.createdAt).toLocaleDateString()}</small></div><StatusPill value={enquiry.status} /></div>;
}
function EnquiryAdminCard({ enquiry, onUpdate, pending }: { enquiry: AdminEnquiry; onUpdate: (data: { status?: AdminEnquiry['status']; internalNote?: string | null }) => void; pending: boolean }) {
  const [note, setNote] = useState(enquiry.internalNote || '');
  return <article className="enquiry-card" data-testid={`card-admin-enquiry-${enquiry.id}`}><div className="enquiry-card-head"><div><span className="eyebrow">{enquiry.reference} · {new Date(enquiry.createdAt).toLocaleString()}</span><h2>{enquiry.name}</h2><p>{enquiry.organisation || 'Individual enquiry'} · prefers {human(enquiry.preferredContactMethod)}</p></div><StatusPill value={enquiry.status} /></div><div className="enquiry-contact-links"><a href={`mailto:${enquiry.contactValue}`}><Mail size={14} />{enquiry.preferredContactMethod === 'email' ? enquiry.contactValue : `Email ${enquiry.contactValue}`}</a>{enquiry.preferredContactMethod !== 'email' && <a href={`tel:${enquiry.contactValue}`}><Phone size={14} />{enquiry.contactValue}</a>}{enquiry.preferredContactMethod === 'whatsapp' && <a href={`https://wa.me/${enquiry.contactValue.replace(/\D/g, '')}`}><MessageCircle size={14} />WhatsApp customer</a>}</div>{enquiry.message && <p className="enquiry-message">{enquiry.message}</p>}{enquiry.locationNotes && <p className="enquiry-meta-text">Location notes: {enquiry.locationNotes}</p>}{enquiry.items.length > 0 && <div className="enquiry-items"><b>Requested products</b>{enquiry.items.map((item) => <span key={item.productId}>{item.title} × {item.quantity}</span>)}</div>}<div className="enquiry-admin-actions"><label>Internal note<textarea value={note} maxLength={2000} rows={2} onChange={(e) => setNote(e.target.value)} placeholder="For CRITS staff only" data-testid={`input-enquiry-note-${enquiry.id}`} /></label><div><button className="small-action" disabled={pending} onClick={() => onUpdate({ internalNote: note || null })} data-testid={`button-save-note-${enquiry.id}`}>Save note</button><label className="status-select-label">Status<select value={enquiry.status} onChange={(e) => onUpdate({ status: e.target.value as AdminEnquiry['status'] })} data-testid={`select-enquiry-status-${enquiry.id}`}><option value="new">New</option><option value="in_progress">In progress</option><option value="replied">Replied</option><option value="closed">Closed</option></select></label></div></div></article>;
}
function Router() {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}><Switch>
    <Route path="/" component={Home} /><Route path="/catalog" component={Catalog} /><Route path="/products/:slug" component={ProductDetail} />
    <Route path="/basket" component={Basket} /><Route path="/contact" component={Contact} /><Route path="/about" component={About} /><Route path="/services" component={Services} /><Route path="/privacy" component={Privacy} />
    <Route path="/sign-in/*?" component={SignInPage} /><Route path="/sign-up/*?" component={SignUpPage} /><Route path="/admin" component={Admin} /><Route component={NotFound} />
  </Switch></ErrorBoundary>;
}

function ClerkProviderWithRoutes() {
  const [, setLocation] = useLocation();
  const stripBase = (path: string) => basePath && path.startsWith(basePath)
    ? path.slice(basePath.length) || '/'
    : path;
  return <ClerkProvider
    publishableKey={clerkPubKey}
    proxyUrl={clerkProxyUrl}
    appearance={clerkAppearance}
    signInUrl={`${basePath}/sign-in`}
    signUpUrl={`${basePath}/sign-up`}
    localization={{
      signIn: { start: { title: 'Welcome back', subtitle: 'Sign in to access the CRITS staff workspace' } },
      signUp: { start: { title: 'Create your account', subtitle: 'Staff access is verified separately by CRITS' } },
    }}
    routerPush={(to) => setLocation(stripBase(to))}
    routerReplace={(to) => setLocation(stripBase(to), { replace: true })}
  >
    <ClerkQueryClientCacheInvalidator />
    <Router />
  </ClerkProvider>;
}

function App() {
  return <QueryClientProvider client={queryClient}><TooltipProvider><WouterRouter base={basePath}><ClerkProviderWithRoutes /></WouterRouter><Toaster /></TooltipProvider></QueryClientProvider>;
}
export default App;
