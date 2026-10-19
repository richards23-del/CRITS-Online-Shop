import { type FormEvent, type ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import './site.css';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { Link, Route, Switch, Router as WouterRouter, useLocation, useParams } from 'wouter';
import { ClerkProvider, SignIn, SignUp, useClerk } from '@clerk/react';
import { shadcn } from '@clerk/themes';
import { jsPDF } from 'jspdf';
import {
  getCheckAdminAccessQueryKey, getGetAdminOverviewQueryKey, getListAdminCategoriesQueryKey,
  getGetAdminSettingsQueryKey, getListAdminEnquiriesQueryKey, getListAdminProductsQueryKey,
  getListAdminPropertiesQueryKey, getListPropertiesQueryKey,
  getListCategoriesQueryKey, getListProductsQueryKey, useCheckAdminAccess, useCreateAdminCategory,
  useCreateAdminProduct, useCreateAdminProperty, useCreateEnquiry, useGetAdminOverview, useGetAdminSettings, useGetProduct,
  useHealthCheck, useImportAdminProducts, useListAdminCategories, useListAdminEnquiries,
  useListAdminProducts, useListAdminProperties, useListProperties, useListCategories, useListProducts, useRecordAnalyticsEvent,
  useRequestProductImageUpload, useUpdateAdminCategory, useUpdateAdminEnquiry,
  useRequestPropertyImageUpload,
  useUpdateAdminProduct, useUpdateAdminProperty, useUpdateAdminSettings,
} from '@workspace/api-client-react';
import type { AdminEnquiry, Category, EnquiryInput, Product, ProductInput, Property, PropertyInput } from '@workspace/api-client-react';
import {
  ArrowDownToLine, ArrowLeft, ArrowRight, ArrowUpRight, BadgeCheck, Boxes, BriefcaseBusiness, Building2,
  Check, CheckCircle2, ChevronDown, CircleHelp, ClipboardList, Clock3, FileText, Filter, HardDrive,
  Headset, Instagram, LayoutDashboard, Linkedin, LockKeyhole, Mail, MapPin, Menu, MessageCircle, Package, Phone, Plus, Search,
  Send, ShieldCheck, ShoppingBasket, SlidersHorizontal, Tag, Upload, Users, X,
} from 'lucide-react';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';

const queryClient = new QueryClient();
const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');
const base = basePath;
const configuredClerkKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY?.trim();
const clerkPubKey = configuredClerkKey || undefined;
const phoneMain = '0200 901 530';
const replacementPhone = '0756 501 530';
const replacementPhoneHref = 'tel:+256756501530';
const whatsapp = import.meta.env.VITE_CRITS_WHATSAPP === undefined
  ? '0788 885 947'
  : import.meta.env.VITE_CRITS_WHATSAPP.trim();
const whatsappDigits = whatsapp.replace(/\D/g, '');
const whatsappInternational = whatsappDigits
  ? whatsappDigits.startsWith('256')
    ? whatsappDigits
    : whatsappDigits.startsWith('0')
      ? `256${whatsappDigits.slice(1)}`
      : `256${whatsappDigits}`
  : '';
const whatsappHref = whatsappInternational ? `https://wa.me/${whatsappInternational}` : '';
const email = 'fairpricesolutions03@gmail.com';
const instagramUrl = 'https://www.instagram.com/crits_ltd/';
const linkedInUrl = 'https://www.linkedin.com/company/candid-services-ltd/';
function whatsappLinkFor(rawNumber: string) {
  const digits = rawNumber.replace(/\D/g, '');
  if (!digits) return '';
  const international = digits.startsWith('256')
    ? digits
    : digits.startsWith('0')
      ? `256${digits.slice(1)}`
      : `256${digits}`;
  return `https://wa.me/${international}`;
}

type BasketLine = { product: Product; quantity: number };
const getBasket = (): BasketLine[] => {
  try { return JSON.parse(localStorage.getItem('crits-enquiry-basket') || '[]') as BasketLine[]; } catch { return []; }
};
const saveBasket = (lines: BasketLine[]) => localStorage.setItem('crits-enquiry-basket', JSON.stringify(lines));
const money = (amount?: number | null) => amount == null ? 'Request a quote' : `UGX ${amount.toLocaleString('en-UG')}`;
const human = (text: string) => text.replaceAll('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase());
const slugify = (text: string) => text.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
function propertyEnquiryHref(property: Pick<Property, 'title' | 'location' | 'landArea' | 'priceUgx'>) {
  const priceLine = property.priceUgx == null ? '' : ` Please confirm the displayed price of ${money(property.priceUgx)}.`;
  const message = `Hello CRITS Limited, I’m interested in the ${property.title} opportunity in ${property.location} (${property.landArea}).${priceLine} Please confirm current availability and share further details.`;
  return `/contact?${new URLSearchParams({ message }).toString()}`;
}
function pageSequence(current: number, total: number): Array<number | 'ellipsis'> {
  if (total <= 7) return Array.from({ length: total }, (_, index) => index + 1);
  if (current <= 4) return [1, 2, 3, 4, 5, 'ellipsis', total];
  if (current >= total - 3) return [1, 'ellipsis', total - 4, total - 3, total - 2, total - 1, total];
  return [1, 'ellipsis', current - 1, current, current + 1, 'ellipsis', total];
}
type PropertyDisplay = Pick<Property, 'slug' | 'title' | 'location' | 'landArea' | 'description' | 'imageUrls' | 'priceUgx' | 'featured'> & {
  id?: number;
  propertyType?: string;
  priceBasis?: string;
};

const nalyaPropertyListing: PropertyDisplay = {
  slug: 'prime-residential-land-nalya',
  title: 'Prime residential land in Naalya, 2.89 acres',
  location: 'Nalyako, Naalya, Nakawa',
  landArea: '2.89 acres',
  description: 'Prime 2.89 acre residential land located in Nalyako, Naalya. The public listing preview confirms the location, size and asking price. Contact CRITS for the complete property information and to confirm current availability.',
  imageUrls: [],
  priceUgx: 3_000_000_000,
  featured: true,
  propertyType: 'Residential land',
  priceBasis: 'Outright price',
};

function parseCsvDocument(text: string): string[][] {
  const input = text.replace(/^\uFEFF/, '');
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;

  for (let i = 0; i < input.length; i += 1) {
    const character = input[i];
    if (quoted) {
      if (character === '"' && input[i + 1] === '"') {
        field += '"';
        i += 1;
      } else if (character === '"') {
        quoted = false;
      } else {
        field += character;
      }
      continue;
    }
    if (character === '"' && field.length === 0) {
      quoted = true;
    } else if (character === '"') {
      throw new Error('Unexpected quote in CSV field');
    } else if (character === ',') {
      row.push(field);
      field = '';
    } else if (character === '\r' || character === '\n') {
      row.push(field);
      if (row.some((value) => value.trim() !== '')) rows.push(row);
      row = [];
      field = '';
      if (character === '\r' && input[i + 1] === '\n') i += 1;
    } else {
      field += character;
    }
  }
  if (quoted) throw new Error('Unclosed quoted CSV field');
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    if (row.some((value) => value.trim() !== '')) rows.push(row);
  }
  return rows;
}
function escapeCsvCell(value: unknown): string {
  const text = String(value ?? '');
  return `"${text.replaceAll('"', '""')}"`;
}
function parseJsonObject(value: string): Record<string, string> {
  if (!value.trim()) return {};
  const parsed: unknown = JSON.parse(value);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Specifications must be a JSON object');
  }
  const entries = Object.entries(parsed);
  if (entries.some(([, item]) => typeof item !== 'string')) {
    throw new Error('Specification values must be text');
  }
  return Object.fromEntries(entries) as Record<string, string>;
}
function parseJsonStringArray(value: string): string[] {
  if (!value.trim()) return [];
  const parsed: unknown = JSON.parse(value);
  if (!Array.isArray(parsed) || parsed.some((item) => typeof item !== 'string')) {
    throw new Error('Image URLs must be a JSON array of strings');
  }
  return parsed;
}

function IconLink({ href, children, className = '' }: { href: string; children: ReactNode; className?: string }) {
  return <Link href={href} className={className}>{children}</Link>;
}
function Button({ children, onClick, href, variant = 'primary', disabled = false, testid }: { children: ReactNode; onClick?: () => void; href?: string; variant?: 'primary' | 'outline' | 'quiet' | 'orange'; disabled?: boolean; testid?: string }) {
  const classes = `button button-${variant} ${disabled ? 'opacity-50 pointer-events-none' : ''}`;
  if (href) return <Link href={href} className={classes} data-testid={testid}>{children}</Link>;
  return <button type="button" className={classes} onClick={onClick} disabled={disabled} data-testid={testid}>{children}</button>;
}
function Brand({ inverse = false }: { inverse?: boolean }) {
  const logo = inverse ? 'crits-logo-light.png' : 'crits-logo-transparent.png';
  return <Link href="/" className="brand" aria-label="CRITS Limited home" data-testid="link-home-logo"><img src={`${base}/${logo}`} alt="CRITS Limited logo" /></Link>;
}
function Header() {
  const [open, setOpen] = useState(false);
  const [path] = useLocation();
  useEffect(() => setOpen(false), [path]);
  const navItems = [
    ['/technology', 'Technology', 'link-technology'],
    ['/catalog', 'Catalogue', 'link-catalog'],
    ['/real-estate', 'Real estate', 'link-real-estate'],
    ['/about', 'About us', 'link-about'],
    ['/contact', 'Contact', 'link-contact'],
  ] as const;
  const nav = navItems.map(([href, label, testid]) => {
    const active = path === href || (href === '/catalog' && path.startsWith('/products/'));
    return <Link key={href} href={href} className={active ? 'nav-current' : undefined} aria-current={active ? 'page' : undefined} data-testid={testid}>{label}</Link>;
  });
  return <header className="site-header">
    <div className="utility"><div className="site-width utility-inner"><span>Quality. Innovation. Reliability.</span><div>{whatsappHref && <a href={whatsappHref} target="_blank" rel="noreferrer" data-testid="link-whatsapp-top"><MessageCircle size={14} /> WhatsApp {whatsapp}</a>}<a href={`mailto:${email}`} data-testid="link-email-top"><Mail size={14} /> {email}</a></div></div></div>
    <div className="site-width nav-row"><Brand /><nav className="desktop-nav" aria-label="Main navigation">{nav}</nav><div className="nav-actions"><Link href="/basket" aria-current={path === '/basket' ? 'page' : undefined} className={`basket-link ${path === '/basket' ? 'active' : ''}`} data-testid="link-basket"><ShoppingBasket size={18} /><span>Enquiry basket</span><BasketCount /></Link><Button href="/contact" variant="orange" testid="button-header-quote">Request a quote <ArrowRight size={16} /></Button></div><button aria-label={open ? 'Close menu' : 'Open menu'} aria-expanded={open} aria-controls="mobile-navigation" className="menu-toggle" onClick={() => setOpen(!open)} data-testid="button-menu"><Menu size={22} /></button></div>
    {open && <nav id="mobile-navigation" className="mobile-nav" aria-label="Mobile navigation">{nav}<Link href="/basket" aria-current={path === '/basket' ? 'page' : undefined}>Enquiry basket</Link><Link href="/contact">Request a quote</Link></nav>}
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
  return <footer className="site-footer"><div className="site-width footer-grid"><div><Brand inverse /><p>CANDID REALTORS &amp; IT SOLUTIONS LIMITED<br />Quality. Innovation. Reliability.</p></div><div><h3>Explore</h3><Link href="/technology">Technology</Link><Link href="/catalog">Product catalogue</Link><Link href="/real-estate">Real estate</Link><Link href="/services">Services</Link><Link href="/about">About CRITS</Link><Link href="/privacy">Privacy notice</Link><Link href="/admin" data-testid="link-staff-sign-in">Staff sign in <LockKeyhole size={13} /></Link></div><div><h3>Talk to our team</h3>{whatsappHref && <a href={whatsappHref} target="_blank" rel="noreferrer"><MessageCircle size={15} /> WhatsApp {whatsapp}</a>}<a href={`tel:+256${phoneMain.replace(/\D/g, '').slice(1)}`}><Phone size={15} /> {phoneMain}</a><a href={replacementPhoneHref}><Phone size={15} /> {replacementPhone}</a><a href="tel:+256393243318"><Phone size={15} /> 0393 243 318</a><a href={`mailto:${email}`}><Mail size={15} /> {email}</a><a href={instagramUrl} target="_blank" rel="noreferrer"><Instagram size={15} /> Instagram</a><a href={linkedInUrl} target="_blank" rel="noreferrer"><Linkedin size={15} /> LinkedIn</a></div><div className="footer-note"><span className="eyebrow">CRITS LIMITED</span><p>Technology and real estate services, shaped around your needs.</p><Button href="/contact" variant="outline">Get in touch <ArrowUpRight size={16} /></Button></div></div><div className="site-width copyright"><span>© {new Date().getFullYear()} CRITS Limited</span><span>Product and property information should be confirmed before a transaction.</span></div></footer>;
}
function Shell({ children }: { children: ReactNode }) {
  return <><a href="#main-content" className="skip-link">Skip to main content</a><Header /><main id="main-content">{children}</main><Footer /></>;
}
function PageHeading({ kicker, title, copy }: { kicker: string; title: string; copy?: string }) {
  return <div className="page-heading"><span className="eyebrow">{kicker}</span><h1>{title}</h1>{copy && <p>{copy}</p>}</div>;
}
function setMeta(attribute: 'name' | 'property', key: string, content: string) {
  let element = document.head.querySelector<HTMLMetaElement>(`meta[${attribute}="${key}"]`);
  if (!element) {
    element = document.createElement('meta');
    element.setAttribute(attribute, key);
    document.head.appendChild(element);
  }
  element.content = content;
}
function usePageMeta(title: string, description: string, image?: string, noIndex = false) {
  useEffect(() => {
    const fullTitle = `${title} | CRITS Limited`;
    document.title = fullTitle;
    setMeta('name', 'description', description);
    setMeta('name', 'robots', noIndex ? 'noindex, nofollow' : 'index, follow');
    setMeta('property', 'og:title', fullTitle);
    setMeta('property', 'og:description', description);
    setMeta('property', 'og:type', 'website');
    setMeta('property', 'og:image', new URL(image || `${base}/crits-logo-transparent.png`, window.location.origin).href);
    setMeta('name', 'twitter:title', fullTitle);
    setMeta('name', 'twitter:description', description);
    setMeta('name', 'twitter:image', new URL(image || `${base}/crits-logo-transparent.png`, window.location.origin).href);
  }, [title, description, image, noIndex]);
}
function ContactBand() {
  return <section className="contact-band site-width"><div><span className="eyebrow">NEED A HAND?</span><h2>Tell us what your work needs.</h2><p>Share a little context. Our team can help with product questions and quote requests.</p></div><Button href="/contact" variant="orange">Talk to CRITS <ArrowRight size={17} /></Button></section>;
}
function QueryFailure({ retry }: { retry: () => void }) {
  return <div className="state-panel error-state"><CircleHelp /><h3>We couldn’t load this just now.</h3><p>Please try again in a moment, or contact our team directly.</p><button className="text-button" onClick={retry} data-testid="button-retry">Try again <ArrowRight size={15} /></button></div>;
}
function ProductCard({ product }: { product: Product }) {
  const [lines, setLines] = useState(getBasket);
  const [failedImageUrl, setFailedImageUrl] = useState('');
  const imageUrl = product.imageUrls[0];
  const add = () => {
    const next = lines.some((line) => line.product.id === product.id)
      ? lines.map((line) => line.product.id === product.id ? { ...line, quantity: line.quantity + 1 } : line)
      : [...lines, { product, quantity: 1 }];
    setLines(next); saveBasket(next); window.dispatchEvent(new Event('crits-basket-change'));
  };
  return <article className="product-card" data-testid={`card-product-${product.id}`}>
    <IconLink href={`/products/${product.slug}`} className="product-image">
      {imageUrl && imageUrl !== failedImageUrl ? <img src={imageUrl} alt={product.title} loading="lazy" decoding="async" onError={() => setFailedImageUrl(imageUrl)} /> : <div className="image-placeholder" role="img" aria-label={imageUrl ? `${product.title} photo unavailable` : `${product.title} product photo pending`}><Package size={34} /><span>{imageUrl ? 'Photo unavailable' : 'Product photo pending'}</span></div>}
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
function TechnologyHome() {
  usePageMeta('Quality Redefined: Technology and business IT supply', 'Browse CRITS Limited’s approved technology listings and send the team a quote enquiry.');
  const health = useHealthCheck();
  const products = useListProducts({ featured: true, pageSize: 4 });
  const cats = useListCategories();
  return <Shell>
    <section className="hero">
      <div className="hero-pattern" />
      <div className="site-width hero-content"><div className="hero-copy page-enter"><div className="hero-badge"><span className="status-dot" /> Product sourcing, made clearer</div><h1>IT that keeps<br /><em>work moving.</em></h1><p>Explore technology selected for business use. Tell us what you need and our team will help you request a considered quote.</p><div className="hero-actions"><Button href="/catalog" variant="orange">Explore the catalogue <ArrowRight size={17} /></Button><Button href="/services" variant="outline">How we can help <ArrowUpRight size={16} /></Button></div><div className="hero-proof"><span><ShieldCheck size={17} /> Staff review before publication</span><span><MessageCircle size={17} /> Talk to a real team</span></div></div>
        <div className="hero-visual" aria-label="CRITS technology sourcing"><div className="hero-orbit orbit-one" /><div className="hero-orbit orbit-two" /><div className="hero-chip chip-blue"><HardDrive size={23} /><span>Business IT</span></div><div className="hero-chip chip-orange"><BadgeCheck size={21} /><span>Reviewed listings</span></div><div className="hero-monogram">C<span>R</span>ITS</div><div className="hero-caption"><span>BUILT AROUND YOUR WORK</span><b>Clear product information.</b></div><div className="hero-stamp">CRITS<br /><small>LIMITED</small></div></div>
      </div><div className="hero-bottom site-width"><span>Clear product information</span><i /><span>No online checkout</span><i /><span>Quotes handled by our team</span></div>
    </section>
    <section className="section site-width intro-section"><div className="section-label"><span>01 / FIND YOUR FIT</span><span className="label-line" /></div><div className="intro-grid"><div><h2>A better way to<br />source your next <em>setup.</em></h2></div><div><p>Compare the details that matter, then send an enquiry when you’re ready. Every catalogue listing is reviewed by CRITS staff before it appears here.</p><Button href="/catalog" variant="quiet">Browse all products <ArrowRight size={16} /></Button></div></div></section>
    <section className="category-section"><div className="site-width"><div className="section-top"><div><span className="eyebrow">EXPLORE BY NEED</span><h2>Start with the work.</h2></div><IconLink href="/catalog" className="text-button">View catalogue <ArrowRight size={15} /></IconLink></div>
      {cats.isLoading ? <div className="category-loading">Loading categories…</div> : cats.isError ? <QueryFailure retry={() => cats.refetch()} /> : cats.data?.length ? <div className="category-list">{cats.data.filter((c) => c.active).map((cat, i) => <IconLink href={`/catalog?category=${encodeURIComponent(cat.slug)}`} className="category-row" key={cat.id} data-testid={`link-category-${cat.id}`}><span className="category-index">0{i + 1}</span><span className="category-name">{cat.name}</span><span className="category-desc">{cat.description || (cat.productCount === 0 ? 'Approved listings coming soon' : `${cat.productCount} listed products`)}</span><ArrowUpRight size={18} /></IconLink>)}</div> : <div className="empty-inline"><Tag size={20} /><div><b>Product categories are being prepared.</b><p>Check back as approved products are added to the catalogue.</p></div></div>}
    </div></section>
    <section className="section featured-section site-width"><div className="section-top"><div><span className="eyebrow">SELECTED LISTINGS</span><h2>Worth a closer look.</h2></div><Button href="/catalog" variant="outline">Browse catalogue <ArrowRight size={16} /></Button></div>{products.isLoading ? <ProductSkeletons /> : products.isError ? <QueryFailure retry={() => products.refetch()} /> : products.data?.items.length ? <div className="product-grid">{products.data.items.map((product) => <ProductCard key={product.id} product={product} />)}</div> : <div className="empty-catalog"><div className="empty-mark"><Boxes size={28} /></div><div><span className="eyebrow">CATALOGUE IN PROGRESS</span><h3>Approved listings will appear here.</h3><p>There are no featured products yet. Our staff are building the catalogue; product listings will only appear once they’ve been reviewed.</p><Button href="/contact" variant="quiet">Ask our team instead <ArrowRight size={15} /></Button></div></div>}</section>
    <section className="trust-section"><div className="site-width trust-grid"><div className="trust-intro"><span className="eyebrow">A THOUGHTFUL PROCESS</span><h2>Useful details.<br />No guesswork.</h2><p>Product availability and pricing can change. We keep the catalogue transparent, and confirm the specifics with you when you enquire.</p></div><div className="trust-step"><span>01</span><ShieldCheck /><h3>Reviewed by staff</h3><p>Listings are checked by our team before they’re published.</p></div><div className="trust-step"><span>02</span><ClipboardList /><h3>Choose what matters</h3><p>Save products to an enquiry basket and send them in one request.</p></div><div className="trust-step"><span>03</span><Headset /><h3>Talk it through</h3><p>Our team follows up using the contact method you prefer.</p></div></div></section>
    <ContactBand /><div className="sr-only" aria-live="polite" data-testid="status-api-health">{health.data?.status ?? ''}</div>
  </Shell>;
}
const landServiceRows = [
  { icon: MapPin, title: 'Land acquisition and disposition', description: 'Marketing, sourcing, purchase and sale facilitation for landowners, buyers and investors.' },
  { icon: BriefcaseBusiness, title: 'Commercial and industrial property', description: 'Land opportunities for warehouses, factories, logistics centres, business parks and offices.' },
  { icon: Package, title: 'Agricultural land and agribusiness', description: 'Land for farming, livestock, poultry, fish farming, agricultural processing and productive investment.' },
  { icon: Users, title: 'Residential development', description: 'Opportunities for homes, apartments, housing estates and planned communities.' },
  { icon: Building2, title: 'Institutional and major projects', description: 'Property sourcing for infrastructure, education, healthcare, transport and storage projects.' },
  { icon: Headset, title: 'Property marketing and investment', description: 'Connecting property representatives with prospective buyers, developers and investment partners.' },
  { icon: ShieldCheck, title: 'Due diligence coordination', description: 'Helping clients organise title, ownership, survey, boundary, access and planning checks with qualified professionals.' },
];

const landProcess = [
  ['01', 'Understand the requirement', 'Clarify location, land size, intended use, timing and investment parameters.'],
  ['02', 'Identify suitable opportunities', 'Source and present properties that fit the brief and available market options.'],
  ['03', 'Facilitate engagement', 'Support professional communication, information exchange and negotiations between relevant parties.'],
  ['04', 'Encourage due diligence', 'Coordinate appropriate legal, survey, ownership and planning verification before commitments.'],
  ['05', 'Support transaction progress', 'Work with the parties and qualified advisers to move agreed transactions forward.'],
];

function PropertyDetailsDialog({ property, onClose }: { property: PropertyDisplay | null; onClose: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [activePhotoIndex, setActivePhotoIndex] = useState(0);
  const photos = property?.imageUrls.filter(Boolean) ?? [];

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (property && !dialog.open) {
      setActivePhotoIndex(0);
      dialog.showModal();
    } else if (!property && dialog.open) {
      dialog.close();
    }
  }, [property]);

  if (!property) return null;
  const detailRows = [
    { label: 'Property type', value: property.propertyType ?? 'Land opportunity' },
    { label: 'Location', value: property.location },
    { label: 'Land area', value: property.landArea },
    { label: 'Asking price', value: money(property.priceUgx) },
    ...(property.priceBasis ? [{ label: 'Price basis', value: property.priceBasis }] : []),
  ];

  return <dialog ref={dialogRef} className="property-details-dialog" aria-labelledby="property-details-title" onCancel={(event) => { event.preventDefault(); onClose(); }} onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <div className="property-details-content">
      <header className="property-details-header"><div><span className="eyebrow">CRITS PROPERTY LISTING</span><h2 id="property-details-title">{property.title}</h2></div><button type="button" className="property-details-close" onClick={onClose} aria-label="Close property details"><X size={19} /></button></header>
      <div className="property-details-layout">
        <div className="property-details-gallery">
          {photos.length ? <>
            <img className="property-details-main-image" src={photos[Math.min(activePhotoIndex, photos.length - 1)]} alt={`${property.title}, photo ${activePhotoIndex + 1}`} />
            {photos.length > 1 && <div className="property-details-thumbnails" aria-label="Property photos">{photos.map((photo, index) => <button type="button" key={`${photo}-${index}`} onClick={() => setActivePhotoIndex(index)} aria-label={`Show property photo ${index + 1}`} aria-pressed={activePhotoIndex === index}><img src={photo} alt="" loading="lazy" /></button>)}</div>}
          </> : <div className="property-details-no-photo"><Building2 size={34} /><b>Request current property photos</b><span>Contact CRITS for recent images and viewing arrangements.</span></div>}
        </div>
        <div className="property-details-information">
          <dl className="property-details-facts">{detailRows.map(({ label, value }) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}<div><dt>Availability</dt><dd>Confirm with CRITS</dd></div></dl>
          <section className="property-full-description"><h3>Property description</h3><p>{property.description || 'Contact CRITS for the full property description.'}</p></section>
          <p className="property-verification-note">Before making a decision, request confirmation of current availability, title and tenure, boundaries, access, utilities and any planning conditions.</p>
          <Link className="button button-primary" href={propertyEnquiryHref(property)}>Enquire about this property <MessageCircle size={16} /></Link>
        </div>
      </div>
    </div>
  </dialog>;
}

function LandListingFeature({ property }: { property?: PropertyDisplay }) {
  const [detailsOpen, setDetailsOpen] = useState(false);
  const listing = property ?? nalyaPropertyListing;
  const imageUrl = listing.imageUrls[0];
  const { title, location, landArea } = listing;
  const price = money(listing.priceUgx);
  const enquiryHref = propertyEnquiryHref(listing);
  return <article className="land-listing-card">
    <figure className={`land-art${imageUrl ? ' has-photo' : ''}`} role="img" aria-label={imageUrl ? `${title} listing photo, ${location}` : `Illustrative land plan for ${location}`}>
      {imageUrl ? <><img src={imageUrl} alt={`${title}, ${location}`} className="land-listing-photo" /><span className="land-photo-caption">{location} &middot; {landArea}</span></> : <>
        <div className="land-art-sun" /><span className="land-art-kicker">CRITS LAND DEPARTMENT &middot; ILLUSTRATIVE PLAN</span>
        <div className="land-art-boundary"><span /><span /><span /><span /></div><div className="land-art-acres">{landArea.split(' ')[0]}<small>{landArea.split(' ').slice(1).join(' ').toUpperCase()}</small></div>
        <div className="land-art-location"><MapPin size={15} /> {location.toUpperCase()}</div><div className="land-art-caption">LAND FOR<br /><b>RESIDENTIAL<br />DEVELOPMENT</b></div>
      </>}
    </figure>
    <div className="land-listing-copy">
      <span className="eyebrow">CRITS PROPERTY LISTING</span>
      <h3>{title}</h3>
      <p className="land-listing-intro">{listing.description}</p>
      <div className="land-listing-facts"><div><small>LOCATION</small><strong>{location}</strong></div><div><small>LAND AREA</small><strong>{landArea}</strong></div></div>
      <div className="land-listing-price"><small>PRICE</small><strong>{price}</strong></div>
      <p className="land-listing-note">Confirm current availability, price, ownership and documentation with CRITS before making a decision.</p>
      <div className="land-listing-actions"><Button href={enquiryHref} testid="link-property-enquiry">Enquire about this property <MessageCircle size={16} /></Button><Button variant="outline" onClick={() => setDetailsOpen(true)}>View full details <ArrowRight size={15} /></Button></div>
    </div>
    <PropertyDetailsDialog property={detailsOpen ? listing : null} onClose={() => setDetailsOpen(false)} />
  </article>;
}

function PropertyCard({ property }: { property: Property }) {
  const [failedImageUrl, setFailedImageUrl] = useState('');
  const [detailsOpen, setDetailsOpen] = useState(false);
  const imageUrl = property.imageUrls[0];
  return <article className="property-card" data-testid={`card-property-${property.id}`}>
    <div className="property-card-image">
      {imageUrl && imageUrl !== failedImageUrl
        ? <img src={imageUrl} alt={`${property.title}, ${property.location}`} loading="lazy" decoding="async" onError={() => setFailedImageUrl(imageUrl)} />
        : <div className="property-photo-placeholder"><Building2 size={31} /><span>Property photo unavailable</span></div>}
      {property.featured && <span className="featured-tag">Featured</span>}
    </div>
    <div className="property-card-body"><span className="eyebrow">{property.landArea}</span><h3>{property.title}</h3><p className="property-card-location"><MapPin size={14} /> {property.location}</p>
      {property.description && <p className="property-card-description">{property.description}</p>}
      <div className="property-card-footer"><strong>{money(property.priceUgx)}</strong><Button variant="outline" onClick={() => setDetailsOpen(true)}>Full details <ArrowRight size={14} /></Button></div>
      <Link className="property-card-enquire" href={propertyEnquiryHref(property)}>Enquire about this property <MessageCircle size={14} /></Link>
    </div>
    <PropertyDetailsDialog property={detailsOpen ? property : null} onClose={() => setDetailsOpen(false)} />
  </article>;
}

function Home() {
  usePageMeta('CRITS Limited | Technology and Real Estate', 'CANDID REALTORS & IT SOLUTIONS LIMITED brings business technology and strategic real estate services together.');
  const properties = useListProperties({ page: 1, pageSize: 12 });
  const spotlight = properties.data?.items.find((property) => property.featured) ?? properties.data?.items[0] ?? nalyaPropertyListing;
  return <Shell>
    <section className="company-hero">
      <div className="company-hero-grid site-width">
        <div className="company-hero-copy page-enter">
          <span className="company-eyebrow"><span /> CANDID REALTORS &amp; IT SOLUTIONS LIMITED</span>
          <h1>Technology for business.<br /><em>Land for what comes next.</em></h1>
          <p>CRITS Limited brings practical technology supply and strategic real estate facilitation together, helping people, organisations and investors move forward with clarity.</p>
          <div className="company-hero-actions"><Button href="/technology" variant="orange">Explore technology <ArrowRight size={16} /></Button><Button href="/real-estate" variant="outline">Discover real estate <ArrowUpRight size={16} /></Button></div>
          <div className="company-values"><span>Quality</span><i /><span>Innovation</span><i /><span>Reliability</span></div>
        </div>
        <div className="company-hero-art" aria-hidden="true">
          <div className="company-art-sun" /><div className="company-art-orbit orbit-a" /><div className="company-art-orbit orbit-b" />
          <div className="company-art-building"><span /><span /><span /><span /><span /><span /><span /><span /><span /></div>
          <div className="company-art-land"><i /><i /><i /></div>
          <div className="company-art-chip chip-tech"><HardDrive size={18} /><span>Business technology</span></div>
          <div className="company-art-chip chip-land"><MapPin size={18} /><span>Strategic land</span></div>
          <div className="company-art-signature">CRITS <small>LIMITED</small></div>
        </div>
      </div>
      <div className="company-hero-foot site-width"><span>CANDID REALTORS &amp; IT SOLUTIONS LIMITED</span><span>UGANDA <i /> TECHNOLOGY <i /> REAL ESTATE</span></div>
    </section>

    <section className="company-intro site-width">
      <div><span className="eyebrow">ONE COMPANY · TWO DIVISIONS</span><h2>Built around the<br /><em>next opportunity.</em></h2></div>
      <p>We work across business technology and property, connecting clients with useful products, relevant land opportunities and professional support. Every conversation starts with understanding what you need.</p>
    </section>

    <section className="company-divisions-section">
      <div className="site-width"><div className="company-section-heading"><span className="eyebrow">WHAT WE DO</span><h2>Two ways we help you move forward.</h2></div>
        <div className="company-division-grid">
          <article className="company-division-card division-tech"><div className="division-icon"><HardDrive size={23} /></div><span className="eyebrow">01 · TECHNOLOGY</span><h3>Business IT, made clearer.</h3><p>Explore technology products for business and get support finding a setup that fits the way you work.</p><div className="division-link-row"><Link href="/catalog">Browse the catalogue <ArrowRight size={16} /></Link><Link href="/services">IT services <ArrowUpRight size={16} /></Link></div></article>
          <article className="company-division-card division-property"><div className="division-icon"><MapPin size={23} /></div><span className="eyebrow">02 · REAL ESTATE</span><h3>Strategic land. Informed investment.</h3><p>We connect landowners, buyers, developers and institutions with property opportunities across Uganda.</p><div className="division-link-row"><Link href="/real-estate">Explore CRITS Land Department <ArrowRight size={16} /></Link></div></article>
        </div>
      </div>
    </section>

    <section className="company-listing-section site-width"><div className="company-section-heading"><span className="eyebrow">PROPERTY SPOTLIGHT</span><h2>{spotlight?.title ?? 'A Naalya opportunity.'}</h2><p>Review the property details and send an enquiry directly to CRITS.</p></div><LandListingFeature property={spotlight} /></section>

    <section className="company-approach"><div className="site-width company-approach-inner"><div><span className="eyebrow">HOW WE WORK</span><h2>Good decisions start<br />with a clear brief.</h2></div><div className="company-approach-copy"><p>Whether the need is technology or land, we listen first, share relevant options and help clients take informed next steps.</p><Link href="/about">Get to know CRITS <ArrowRight size={16} /></Link></div></div></section>
    <section className="company-contact-cta site-width"><div><span className="eyebrow">LET’S TALK</span><h2>Tell us what you’re working toward.</h2><p>Discuss a technology requirement, a land opportunity or a business enquiry with our team.</p></div><div className="company-cta-actions"><Button href="/contact" variant="orange">Contact CRITS <ArrowRight size={16} /></Button><a href={replacementPhoneHref}><Phone size={15} /> {replacementPhone}</a></div></section>
  </Shell>;
}

function RealEstatePage() {
  usePageMeta('CRITS Land Department', 'Strategic real estate and land investment solutions from CRITS Limited in Uganda.');
  const propertyPageSize = 6;
  const initialPropertyPage = Number(new URLSearchParams(window.location.search).get('page'));
  const [propertyPage, setPropertyPage] = useState(() => Number.isSafeInteger(initialPropertyPage) && initialPropertyPage > 0 ? initialPropertyPage : 1);
  const properties = useListProperties({ page: propertyPage, pageSize: propertyPageSize });
  const propertyTotal = properties.data?.total ?? 0;
  const usingNalyaFallback = !properties.isLoading && propertyTotal === 0;
  const displayedPropertyTotal = propertyTotal || (usingNalyaFallback ? 1 : 0);
  const propertyPageCount = Math.max(1, Math.ceil(propertyTotal / propertyPageSize));
  const propertyItems = properties.data?.items ?? [];
  const spotlight = propertyPage === 1 ? propertyItems.find((property) => property.featured) ?? propertyItems[0] ?? (usingNalyaFallback ? nalyaPropertyListing : undefined) : undefined;
  const additionalProperties = spotlight ? propertyItems.filter((property) => property.id !== spotlight.id) : propertyItems;
  const firstProperty = displayedPropertyTotal ? ((propertyPage - 1) * propertyPageSize) + 1 : 0;
  const lastProperty = Math.min(propertyPage * propertyPageSize, displayedPropertyTotal);
  const lastNavigatedPropertyPage = useRef(propertyPage);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (propertyPage > 1) params.set('page', String(propertyPage));
    else params.delete('page');
    const search = params.toString();
    const nextUrl = `${window.location.pathname}${search ? `?${search}` : ''}${window.location.hash}`;
    const currentUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    if (nextUrl !== currentUrl) window.history.replaceState(window.history.state, '', nextUrl);
  }, [propertyPage]);
  useEffect(() => {
    const restorePageFromUrl = () => {
      const requested = Number(new URLSearchParams(window.location.search).get('page'));
      setPropertyPage(Number.isSafeInteger(requested) && requested > 0 ? requested : 1);
    };
    window.addEventListener('popstate', restorePageFromUrl);
    return () => window.removeEventListener('popstate', restorePageFromUrl);
  }, []);
  useEffect(() => {
    if (propertyPage > propertyPageCount) setPropertyPage(propertyPageCount);
  }, [propertyPage, propertyPageCount]);
  useEffect(() => {
    if (properties.isFetching || lastNavigatedPropertyPage.current === propertyPage) return;
    lastNavigatedPropertyPage.current = propertyPage;
    const results = document.getElementById('property-results');
    results?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    results?.focus({ preventScroll: true });
  }, [propertyPage, properties.isFetching]);
  const navigateToPropertyPage = (nextPage: number) => {
    const boundedPage = Math.max(1, Math.min(propertyPageCount, nextPage));
    if (boundedPage === propertyPage) return;
    const nextUrl = new URL(window.location.href);
    if (boundedPage === 1) nextUrl.searchParams.delete('page');
    else nextUrl.searchParams.set('page', String(boundedPage));
    window.history.pushState(window.history.state, '', `${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}`);
    setPropertyPage(boundedPage);
  };
  return <Shell>
    <section className="estate-hero"><div className="site-width estate-hero-grid">
      <div className="estate-hero-copy page-enter"><div className="estate-kicker"><MapPin size={15} /> CANDID REALTORS &amp; IT SOLUTIONS LIMITED</div><span className="eyebrow">CRITS LAND DEPARTMENT</span><h1>Strategic land.<br /><em>Informed investment.</em></h1><p>Professional real estate services that connect landowners, investors, developers, institutions and businesses with opportunities across Uganda.</p><div className="company-hero-actions"><a className="button button-orange" href="#property-results">Browse property listings <ArrowRight size={16} /></a><a className="button button-outline" href={replacementPhoneHref}>Call {replacementPhone} <Phone size={15} /></a></div></div>
      <div className="estate-hero-visual" aria-hidden="true"><div className="estate-map-lines" /><div className="estate-parcel parcel-one" /><div className="estate-parcel parcel-two" /><div className="estate-parcel parcel-three" /><div className="estate-map-pin"><MapPin size={25} /><span>UGANDA</span></div><div className="estate-map-caption">LOCATION<br /><b>MEETS POTENTIAL</b></div></div>
    </div></section>
    <section className="estate-overview site-width"><div><span className="eyebrow">ABOUT THE DEPARTMENT</span><h2>Connecting land and opportunity.</h2></div><div><p>CRITS Land Department is the real estate and land investment division of CANDID REALTORS &amp; IT SOLUTIONS LIMITED. We facilitate strategic property transactions and help unlock the value of land through professional services, solutions for investors and trusted business relationships.</p><p>Our work spans land ownership, property investment and development, supporting informed decisions for residential, commercial, industrial and agricultural needs.</p></div></section>
    <section className="estate-services"><div className="site-width"><div className="company-section-heading"><span className="eyebrow">OUR CORE AREAS</span><h2>Real estate support from first brief to next step.</h2><p>We consider location, size, access, intended use, documentation and each client’s requirements.</p></div><div className="estate-service-grid">{landServiceRows.map(({ icon: Icon, title, description }, index) => <article className="estate-service-card" key={title}><span className="estate-service-number">0{index + 1}</span><Icon size={22} /><h3>{title}</h3><p>{description}</p></article>)}</div></div></section>
    <section className="estate-focus site-width"><div className="estate-focus-copy"><span className="eyebrow">OUR MARKET FOCUS</span><h2>Opportunities across Uganda.</h2><p>We focus on Kampala and surrounding growth corridors, together with selected regional locations for agricultural production, commercial expansion, industrial activity and planned development.</p></div><div className="estate-audience-grid"><div><Users /><b>Landowners</b><span>Seeking credible market access.</span></div><div><BriefcaseBusiness /><b>Investors and companies</b><span>Planning strategic or operational growth.</span></div><div><Building2 /><b>Developers and institutions</b><span>Seeking land for residential developments and major projects.</span></div><div><Package /><b>Agricultural partners</b><span>Exploring productive land and agribusiness.</span></div></div></section>
    <section className="estate-process"><div className="site-width"><div className="company-section-heading"><span className="eyebrow">OUR APPROACH</span><h2>Clear steps. Careful decisions.</h2></div><div className="estate-process-grid">{landProcess.map(([number, title, description]) => <article key={number}><span>{number}</span><h3>{title}</h3><p>{description}</p></article>)}</div><p className="estate-professional-note"><ShieldCheck size={18} /> Land transactions require independent verification. Legal, surveying and specialist work should be handled by qualified professionals or competent authorities.</p></div></section>
    <section className="estate-vision site-width"><article><span className="eyebrow">OUR VISION</span><h2>A trusted land investment partner.</h2><p>To connect valuable land opportunities with responsible investment, productive development and lasting value in Uganda.</p></article><article><span className="eyebrow">OUR MISSION</span><h2>Professional facilitation for informed investment.</h2><p>To connect property owners, investors, developers and institutions through reliable service, informed engagement and integrity.</p></article><article><span className="eyebrow">OUR VALUES</span><h2>Integrity in every engagement.</h2><p>Professionalism, client focus, market awareness, confidentiality and lasting partnerships guide our work.</p></article></section>
    <section className="company-listing-section site-width property-results-section" id="property-results" tabIndex={-1}>
      <div className="company-section-heading"><span className="eyebrow">CRITS LAND DEPARTMENT</span><h2>Property opportunities.</h2><p>Browse current listings and contact CRITS directly to confirm availability and arrange more information.</p></div>
      {properties.isLoading ? <div className="property-grid">{[1, 2, 3].map((item) => <div className="property-card-skeleton" key={item}><div className="skeleton-img" /><div className="skeleton-line" /><div className="skeleton-line short" /></div>)}</div>
        : properties.isError ? <><LandListingFeature property={nalyaPropertyListing} /><QueryFailure retry={() => properties.refetch()} /></>
          : propertyItems.length || usingNalyaFallback ? <>
            {spotlight && <LandListingFeature property={spotlight} />}
            {!!additionalProperties.length && <div className="property-grid">{additionalProperties.map((property) => <PropertyCard key={property.id} property={property} />)}</div>}
            <div className="property-result-bar" aria-live="polite"><span>{usingNalyaFallback ? 'One property opportunity is shown. Confirm availability with CRITS.' : `Showing ${firstProperty} to ${lastProperty} of ${propertyTotal} ${propertyTotal === 1 ? 'property' : 'properties'}`}</span><span>Page {propertyPage} of {propertyPageCount}</span></div>
            {propertyPageCount > 1 && <nav className="catalog-pagination" aria-label="Property listings pagination"><button type="button" className="pagination-step" onClick={() => navigateToPropertyPage(propertyPage - 1)} disabled={propertyPage <= 1} aria-label="Go to previous property page">Previous</button>{pageSequence(propertyPage, propertyPageCount).map((item, index) => item === 'ellipsis' ? <span key={`ellipsis-${index}`} className="pagination-ellipsis" aria-hidden="true">…</span> : <button type="button" key={item} className="pagination-number" onClick={() => navigateToPropertyPage(item)} aria-label={`Go to property page ${item}`} aria-current={propertyPage === item ? 'page' : undefined}>{item}</button>)}<button type="button" className="pagination-step" onClick={() => navigateToPropertyPage(propertyPage + 1)} disabled={propertyPage >= propertyPageCount} aria-label="Go to next property page">Next</button></nav>}
          </>
            : <div className="empty-catalog large"><div className="empty-mark"><Building2 size={28} /></div><div><span className="eyebrow">PROPERTY LISTINGS</span><h3>No current public listings.</h3><p>Tell our team what location and property type you’re looking for, and we’ll help you explore suitable opportunities.</p><Button href="/contact" variant="outline">Enquire with CRITS <ArrowRight size={15} /></Button></div></div>}
    </section>
    <section className="estate-contact"><div className="site-width estate-contact-inner"><div><span className="eyebrow">PARTNER WITH CRITS LAND DEPARTMENT</span><h2>Let’s discuss your land requirement.</h2><p>Whether you want to acquire land, market a property or explore an investment opportunity, tell us what you’re looking for.</p></div><div><a className="button button-orange" href="/contact">Send an enquiry <ArrowRight size={16} /></a><a className="estate-phone" href={replacementPhoneHref}><Phone size={16} /> {replacementPhone}</a></div></div></section>
  </Shell>;
}

function Catalog() {
  const initialParams = new URLSearchParams(window.location.search);
  const initialCondition = initialParams.get('condition');
  const initialAvailability = initialParams.get('availability');
  const initialSort = initialParams.get('sort');
  const initialMinPrice = initialParams.get('minPrice') || '';
  const initialMaxPrice = initialParams.get('maxPrice') || '';
  const [query, setQuery] = useState(initialParams.get('q') || '');
  const [category, setCategory] = useState(initialParams.get('category') || '');
  const [brand, setBrand] = useState(initialParams.get('brand') || '');
  const [condition, setCondition] = useState<'' | 'new' | 'used' | 'refurbished'>(initialCondition === 'new' || initialCondition === 'used' || initialCondition === 'refurbished' ? initialCondition : '');
  const [availability, setAvailability] = useState<'' | 'available' | 'quote' | 'out_of_stock'>(initialAvailability === 'available' || initialAvailability === 'quote' || initialAvailability === 'out_of_stock' ? initialAvailability : '');
  const [minPrice, setMinPrice] = useState(/^\d+$/.test(initialMinPrice) ? initialMinPrice : '');
  const [maxPrice, setMaxPrice] = useState(/^\d+$/.test(initialMaxPrice) ? initialMaxPrice : '');
  const [sort, setSort] = useState(initialSort === 'newest' || initialSort === 'popular' || initialSort === 'price-low' || initialSort === 'price-high' ? initialSort : 'featured');
  const [page, setPage] = useState(() => {
    const requestedPage = Number(initialParams.get('page'));
    return Number.isSafeInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  });
  const [applied, setApplied] = useState(query);
  const [filterError, setFilterError] = useState('');
  const lastNavigatedPage = useRef(page);
  usePageMeta('Product catalogue', 'Search and filter approved CRITS Limited products by category, brand, condition, availability and price.');
  const categories = useListCategories();
  const pageSize = 12;
  const queryParams = useMemo(() => ({
    q: applied || undefined,
    category: category || undefined,
    brand: brand.trim() || undefined,
    condition: condition || undefined,
    availability: availability || undefined,
    minPrice: minPrice === '' ? undefined : Number(minPrice),
    maxPrice: maxPrice === '' ? undefined : Number(maxPrice),
    sort: sort as 'featured' | 'newest' | 'price-low' | 'price-high' | 'popular',
    page,
    pageSize,
  }), [applied, category, brand, condition, availability, minPrice, maxPrice, sort, page]);
  const products = useListProducts(queryParams);
  const record = useRecordAnalyticsEvent();
  useEffect(() => { if (applied.trim()) record.mutate({ data: { event: 'search', query: applied.trim() } }); }, [applied]); // analytics query intentionally records searches
  const pageCount = Math.max(1, Math.ceil((products.data?.total ?? 0) / pageSize));
  const total = products.data?.total ?? 0;
  const firstResult = total ? ((page - 1) * pageSize) + 1 : 0;
  const lastResult = Math.min(page * pageSize, total);
  const hasFilters = Boolean(applied || category || brand || condition || availability || minPrice || maxPrice);
  useEffect(() => {
    const nextParams = new URLSearchParams();
    if (applied) nextParams.set('q', applied);
    if (category) nextParams.set('category', category);
    if (brand.trim()) nextParams.set('brand', brand.trim());
    if (condition) nextParams.set('condition', condition);
    if (availability) nextParams.set('availability', availability);
    if (minPrice) nextParams.set('minPrice', minPrice);
    if (maxPrice) nextParams.set('maxPrice', maxPrice);
    if (sort !== 'featured') nextParams.set('sort', sort);
    if (page > 1) nextParams.set('page', String(page));
    const search = nextParams.toString();
    const nextUrl = `${window.location.pathname}${search ? `?${search}` : ''}${window.location.hash}`;
    const currentUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    if (nextUrl !== currentUrl) window.history.replaceState(window.history.state, '', nextUrl);
  }, [applied, category, brand, condition, availability, minPrice, maxPrice, sort, page]);
  useEffect(() => {
    const restoreFromUrl = () => {
      const params = new URLSearchParams(window.location.search);
      const nextQuery = params.get('q') || '';
      const requestedPage = Number(params.get('page'));
      const nextCondition = params.get('condition');
      const nextAvailability = params.get('availability');
      const nextSort = params.get('sort');
      setQuery(nextQuery);
      setApplied(nextQuery);
      setCategory(params.get('category') || '');
      setBrand(params.get('brand') || '');
      setCondition(nextCondition === 'new' || nextCondition === 'used' || nextCondition === 'refurbished' ? nextCondition : '');
      setAvailability(nextAvailability === 'available' || nextAvailability === 'quote' || nextAvailability === 'out_of_stock' ? nextAvailability : '');
      const nextMinPrice = params.get('minPrice') || '';
      const nextMaxPrice = params.get('maxPrice') || '';
      setMinPrice(/^\d+$/.test(nextMinPrice) ? nextMinPrice : '');
      setMaxPrice(/^\d+$/.test(nextMaxPrice) ? nextMaxPrice : '');
      setSort(nextSort === 'newest' || nextSort === 'popular' || nextSort === 'price-low' || nextSort === 'price-high' ? nextSort : 'featured');
      setPage(Number.isSafeInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1);
      setFilterError('');
    };
    window.addEventListener('popstate', restoreFromUrl);
    return () => window.removeEventListener('popstate', restoreFromUrl);
  }, []);
  useEffect(() => {
    if (products.data && page > pageCount) setPage(pageCount);
  }, [products.data, page, pageCount]);
  useEffect(() => {
    if (products.isFetching || lastNavigatedPage.current === page) return;
    lastNavigatedPage.current = page;
    const results = document.getElementById('catalog-listings');
    results?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    results?.focus({ preventScroll: true });
  }, [page, products.isFetching]);
  const navigateToPage = (nextPage: number) => {
    const boundedPage = Math.max(1, Math.min(pageCount, nextPage));
    if (boundedPage === page) return;
    const nextUrl = new URL(window.location.href);
    if (boundedPage === 1) nextUrl.searchParams.delete('page');
    else nextUrl.searchParams.set('page', String(boundedPage));
    window.history.pushState(window.history.state, '', `${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}`);
    setPage(boundedPage);
  };
  const search = (e: FormEvent) => {
    e.preventDefault();
    if (minPrice && maxPrice && Number(minPrice) > Number(maxPrice)) {
      setFilterError('Minimum price must not be greater than maximum price.');
      return;
    }
    setFilterError('');
    setApplied(query.trim());
    setPage(1);
  };
  const clearFilters = () => {
    setQuery('');
    setApplied('');
    setCategory('');
    setBrand('');
    setCondition('');
    setAvailability('');
    setMinPrice('');
    setMaxPrice('');
    setSort('featured');
    setPage(1);
    setFilterError('');
  };
  return <Shell><div className="site-width page-wrap page-enter"><div className="breadcrumb"><Link href="/">Home</Link><span>/</span><span>Catalogue</span></div><PageHeading kicker="THE CRITS CATALOGUE" title="Find the right tools for your work." copy="Search approved listings, compare the details and send a quote enquiry when you’re ready. No online checkout." />
    <form className="catalog-controls" onSubmit={search}>
      <label className="search-box"><Search size={18} /><input aria-label="Search products" placeholder="Search products, brands or models" value={query} onChange={(e) => setQuery(e.target.value)} data-testid="input-catalog-search" /><button type="submit" className="search-submit" data-testid="button-search">Apply filters</button></label>
      <label className="select-control"><Filter size={16} /><select aria-label="Filter by category" value={category} onChange={(e) => { setCategory(e.target.value); setPage(1); }} data-testid="select-category"><option value="">All categories</option>{categories.data?.filter((c) => c.active).map((c) => <option value={c.slug} key={c.id}>{c.name}</option>)}</select><ChevronDown size={15} /></label>
      <label className="filter-input">Brand<input aria-label="Filter by brand" placeholder="Any brand" value={brand} onChange={(e) => { setBrand(e.target.value); setPage(1); }} /></label>
      <label className="select-control"><SlidersHorizontal size={16} /><select aria-label="Filter by condition" value={condition} onChange={(e) => { setCondition(e.target.value as typeof condition); setPage(1); }}><option value="">Any condition</option><option value="new">New</option><option value="used">Used</option><option value="refurbished">Refurbished</option></select><ChevronDown size={15} /></label>
      <label className="select-control"><select aria-label="Filter by availability" value={availability} onChange={(e) => { setAvailability(e.target.value as typeof availability); setPage(1); }}><option value="">Any availability</option><option value="available">Available</option><option value="quote">Request a quote</option><option value="out_of_stock">Out of stock</option></select><ChevronDown size={15} /></label>
      <label className="filter-input">Min price (UGX)<input aria-label="Minimum price in UGX" type="number" min="0" step="1" value={minPrice} onChange={(e) => { setMinPrice(e.target.value); setPage(1); }} /></label>
      <label className="filter-input">Max price (UGX)<input aria-label="Maximum price in UGX" type="number" min="0" step="1" value={maxPrice} onChange={(e) => { setMaxPrice(e.target.value); setPage(1); }} /></label>
      <label className="select-control"><select aria-label="Sort products" value={sort} onChange={(e) => { setSort(e.target.value); setPage(1); }}><option value="featured">Featured first</option><option value="newest">Recently added</option><option value="popular">Most viewed</option><option value="price-low">Price: low to high</option><option value="price-high">Price: high to low</option></select><ChevronDown size={15} /></label>
    </form>
    {filterError && <p className="form-error" role="alert">{filterError}</p>}
    <div className="result-bar"><span data-testid="text-catalog-results">{products.data ? total ? `Showing ${firstResult} to ${lastResult} of ${total} ${total === 1 ? 'listing' : 'listings'}` : 'No listings found' : 'Catalogue listings'}</span><span>Prices and availability confirmed during enquiry</span></div>
    {products.isLoading ? <ProductSkeletons /> : products.isError ? <QueryFailure retry={() => products.refetch()} /> : products.data?.items.length ? <><div className="product-grid" id="catalog-listings" tabIndex={-1}>{products.data.items.map((p) => <ProductCard key={p.id} product={p} />)}</div>{pageCount > 1 && <nav className="catalog-pagination" aria-label="Catalogue pagination"><button type="button" className="pagination-step" onClick={() => navigateToPage(page - 1)} disabled={page <= 1} aria-label="Go to previous page">Previous</button>{pageSequence(page, pageCount).map((item, index) => item === 'ellipsis' ? <span key={`ellipsis-${index}`} className="pagination-ellipsis" aria-hidden="true">…</span> : <button type="button" key={item} className="pagination-number" onClick={() => navigateToPage(item)} aria-label={`Go to page ${item}`} aria-current={page === item ? 'page' : undefined}>{item}</button>)}<button type="button" className="pagination-step" onClick={() => navigateToPage(page + 1)} disabled={page >= pageCount} aria-label="Go to next page">Next</button><span className="pagination-page-status" aria-live="polite">Page {page} of {pageCount}</span></nav>}</> : <div className="empty-catalog large"><div className="empty-mark"><Search size={27} /></div><div><span className="eyebrow">{hasFilters ? 'NO MATCHES YET' : 'A NEW CATALOGUE'}</span><h3>{hasFilters ? 'No listings matched those filters.' : 'The catalogue is ready for approved listings.'}</h3><p>{hasFilters ? 'Try a different search or clear the filters. Our team can also help you find what you need.' : 'CRITS staff are preparing product listings. Once approved, you’ll be able to explore the catalogue here.'}</p><div className="empty-actions"><Button href="/contact" variant="outline">Ask our team <ArrowRight size={15} /></Button>{hasFilters && <button className="text-button" onClick={clearFilters}>Clear filters <X size={15} /></button>}</div></div></div>}
  </div><ContactBand /></Shell>;
}
function ProductDetail() {
  const { slug = '' } = useParams<{ slug: string }>();
  const productQuery = useGetProduct(slug);
  const currentProduct = productQuery.data?.product;
  const [failedImageUrl, setFailedImageUrl] = useState('');
  usePageMeta(
    currentProduct?.title || 'Product details',
    currentProduct?.description || 'View product details and request a quote from CRITS Limited.',
    currentProduct?.imageUrls[0],
  );
  const analytics = useRecordAnalyticsEvent();
  const [quantity, setQuantity] = useState(1);
  useEffect(() => { if (productQuery.data?.product) analytics.mutate({ data: { event: 'product_view', productId: productQuery.data.product.id } }); }, [productQuery.data?.product?.id]);
  if (productQuery.isLoading) return <Shell><div className="site-width page-wrap"><div className="skeleton-detail" /></div></Shell>;
  if (productQuery.isError || !productQuery.data) return <Shell><div className="site-width page-wrap"><QueryFailure retry={() => productQuery.refetch()} /></div></Shell>;
  const p = productQuery.data.product;
  const structuredProduct = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: p.title,
    description: p.description,
    image: p.imageUrls.map((url) => new URL(url, window.location.origin).href),
    category: p.categoryName,
    brand: p.brand ? { '@type': 'Brand', name: p.brand } : undefined,
    model: p.model || undefined,
    sku: p.sku || undefined,
    itemCondition: `https://schema.org/${p.condition === 'new' ? 'NewCondition' : p.condition === 'used' ? 'UsedCondition' : 'RefurbishedCondition'}`,
    offers: p.priceUgx == null ? undefined : {
      '@type': 'Offer',
      price: p.priceUgx,
      priceCurrency: 'UGX',
      availability: `https://schema.org/${p.availability === 'out_of_stock' ? 'OutOfStock' : p.availability === 'available' ? 'InStock' : 'PreOrder'}`,
      url: window.location.href,
    },
  };
  const add = () => {
    const lines = getBasket(); const found = lines.find((line) => line.product.id === p.id);
    const next = found ? lines.map((line) => line.product.id === p.id ? { ...line, quantity: line.quantity + quantity } : line) : [...lines, { product: p, quantity }];
    saveBasket(next); window.dispatchEvent(new Event('crits-basket-change'));
  };
  return <><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredProduct).replace(/</g, '\\u003c') }} /><Shell><div className="site-width page-wrap page-enter"><div className="breadcrumb"><Link href="/">Home</Link><span>/</span><Link href="/catalog">Catalogue</Link><span>/</span><span>{p.title}</span></div><div className="detail-layout"><div className="detail-image">{p.imageUrls[0] && p.imageUrls[0] !== failedImageUrl ? <img src={p.imageUrls[0]} alt={p.title} decoding="async" onError={() => setFailedImageUrl(p.imageUrls[0])} /> : <div className="image-placeholder" role="img" aria-label={p.imageUrls[0] ? `${p.title} photo unavailable` : `${p.title} product photo pending`}><Package size={48} /><span>{p.imageUrls[0] ? 'Photo unavailable' : 'Product photo pending'}</span></div>}</div><div className="detail-copy"><span className="eyebrow">{p.categoryName}</span><h1 data-testid="text-product-title">{p.title}</h1>{(p.brand || p.model) && <p className="detail-model">{[p.brand, p.model].filter(Boolean).join(' / ')}</p>}<div className="detail-price">{money(p.priceUgx)}</div><p className="detail-description">{p.description}</p><div className="detail-badges"><span><BadgeCheck size={15} /> Staff reviewed listing</span><span><Package size={15} /> {human(p.condition)}</span></div><div className="detail-availability">Availability: <b>{human(p.availability)}</b><small>Confirm current availability with our team.</small></div><div className="detail-actions"><div className="quantity-control"><button aria-label="Decrease quantity" onClick={() => setQuantity(Math.max(1, quantity - 1))}>−</button><span data-testid="text-product-quantity">{quantity}</span><button aria-label="Increase quantity" onClick={() => setQuantity(Math.min(100, quantity + 1))}>+</button></div><Button onClick={add} variant="orange" testid="button-add-to-basket">Add to enquiry basket <ShoppingBasket size={17} /></Button></div><p className="no-checkout">No payment or checkout here. Send an enquiry and we’ll follow up.</p></div></div>
    <div className="spec-panel"><div><span className="eyebrow">PRODUCT DETAILS</span><h2>Specifications</h2></div><dl>{Object.entries(p.specifications || {}).map(([key, value]) => <div key={key}><dt>{key}</dt><dd>{value}</dd></div>)}</dl></div>
    {!!productQuery.data.related.length && <section className="section related"><div className="section-top"><div><span className="eyebrow">MORE TO EXPLORE</span><h2>Related listings</h2></div><Button href="/catalog" variant="outline">All products <ArrowRight size={15} /></Button></div><div className="product-grid">{productQuery.data.related.map((x) => <ProductCard key={x.id} product={x} />)}</div></section>}
  </div><ContactBand /></Shell></>;
}
function ContactForm({ initialLines = [], initialMessage = '' }: { initialLines?: BasketLine[]; initialMessage?: string }) {
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
      website: String(form.get('website') || ''),
      items: initialLines.map((line) => ({ productId: line.product.id, quantity: line.quantity })),
    };
    create.mutate({ data: payload }, { onSuccess: (receipt) => { setSuccessRef(receipt.reference); if (initialLines.length) { saveBasket([]); window.dispatchEvent(new Event('crits-basket-change')); } }, onError: () => setErrorText('Your enquiry could not be sent. Please try again or contact us directly.') });
  };
  if (successRef) return <div className="success-panel" role="status" data-testid="status-enquiry-success"><div className="success-icon"><Check size={26} /></div><span className="eyebrow">ENQUIRY RECEIVED</span><h2>Thanks for getting in touch.</h2><p>Your reference is <b>{successRef}</b>. Our team will respond using your preferred contact method.</p><Button href="/" variant="outline">Back to home <ArrowRight size={16} /></Button></div>;
  return <form className="enquiry-form" onSubmit={submit} noValidate>
    <div className="form-heading"><span className="eyebrow">SEND AN ENQUIRY</span><h2>Let’s start a conversation.</h2><p>We’ll use your preferred contact method to follow up.</p></div>
    <div className="form-grid"><label className="field">Your name <input name="name" required maxLength={160} placeholder="Name" data-testid="input-enquiry-name" /></label><label className="field">Organisation <span className="optional">Optional</span><input name="organisation" maxLength={180} placeholder="Company or organisation" data-testid="input-enquiry-organisation" /></label>
      <label className="field">Preferred contact method<select value={contactMethod} onChange={(e) => setContactMethod(e.target.value as typeof contactMethod)} data-testid="select-contact-method"><option value="whatsapp">WhatsApp</option><option value="phone">Telephone</option><option value="email">Email</option></select></label><label className="field">Contact detail<input name="contactValue" required minLength={3} maxLength={254} placeholder={contactMethod === 'email' ? 'you@example.com' : 'Your phone number'} data-testid="input-enquiry-contact" /></label>
      <label className="field full">Location or delivery notes <span className="optional">Optional</span><input name="locationNotes" maxLength={1000} placeholder="Area or any helpful context" data-testid="input-enquiry-location" /></label><label className="field full">How can we help? <span className="optional">Optional</span><textarea name="message" maxLength={3000} rows={4} defaultValue={initialMessage} placeholder="Tell us a little about what you’re looking for." data-testid="input-enquiry-message" /></label></div>
    <label className="honeypot-field" aria-hidden="true">Website<input name="website" tabIndex={-1} autoComplete="off" /></label>
    {errorText && <div className="form-error" role="alert" data-testid="status-enquiry-error">{errorText}</div>}<button className="button button-primary form-submit" type="submit" disabled={create.isPending} data-testid="button-submit-enquiry">{create.isPending ? 'Sending enquiry…' : 'Send enquiry'} {create.isPending ? <span className="tiny-loader" /> : <Send size={16} />}</button><p className="form-privacy">Your information is used to respond to this enquiry. See our <Link href="/privacy">privacy notice</Link>.</p>
  </form>;
}
function Contact() {
  usePageMeta('Contact CRITS', 'Contact CRITS Limited by phone, email or WhatsApp, or send an enquiry through the website.');
  const initialMessage = new URLSearchParams(window.location.search).get('message') || '';
  return <Shell><div className="site-width page-wrap page-enter"><div className="breadcrumb"><Link href="/">Home</Link><span>/</span><span>Contact</span></div><div className="contact-layout"><div><PageHeading kicker="WE’RE HERE TO HELP" title="Talk to CRITS Limited." copy="Discuss a technology requirement, a property opportunity, or a general business enquiry. Tell us how you’d like us to reach you." /><div className="contact-methods">{whatsappHref && <a href={whatsappHref} target="_blank" rel="noreferrer" className="contact-method" data-testid="link-whatsapp-contact"><span className="contact-icon"><MessageCircle /></span><span><b>WhatsApp</b><small>{whatsapp}</small></span><ArrowUpRight size={17} /></a>}<a href="tel:+256200901530" className="contact-method"><span className="contact-icon"><Phone /></span><span><b>Telephone</b><small>{phoneMain} · 0756 501 530 · 0393 243 318</small></span><ArrowUpRight size={17} /></a><a href={`mailto:${email}`} className="contact-method"><span className="contact-icon"><Mail /></span><span><b>Email</b><small>{email}</small></span><ArrowUpRight size={17} /></a><a href={instagramUrl} target="_blank" rel="noreferrer" className="contact-method"><span className="contact-icon"><Instagram /></span><span><b>Instagram</b><small>@crits_ltd</small></span><ArrowUpRight size={17} /></a><a href={linkedInUrl} target="_blank" rel="noreferrer" className="contact-method"><span className="contact-icon"><Linkedin /></span><span><b>LinkedIn</b><small>CRITS LIMITED</small></span><ArrowUpRight size={17} /></a></div></div><ContactForm initialMessage={initialMessage} /></div></div></Shell>;
}
function Basket() {
  const [lines, setLines] = useState(getBasket);
  usePageMeta('Enquiry basket', 'Review selected products and send CRITS Limited a quote enquiry.');
  const update = (next: BasketLine[]) => { setLines(next); saveBasket(next); window.dispatchEvent(new Event('crits-basket-change')); };
  const whatsappMessage = `Hello CRITS Limited, please send me a quote for:\n${lines.map(({ product, quantity }) => `• ${product.title}: quantity ${quantity}`).join('\n')}\n\nPlease confirm current price and availability.`;
  const whatsappBasketLink = whatsappHref
    ? `${whatsappHref}?text=${encodeURIComponent(whatsappMessage)}`
    : '';
  return <Shell><div className="site-width page-wrap page-enter"><div className="breadcrumb"><Link href="/">Home</Link><span>/</span><span>Enquiry basket</span></div><PageHeading kicker="YOUR SHORTLIST" title="Enquiry basket." copy="Collect products you’d like to ask us about, then send them in one enquiry. This is not a checkout." />
    <div className="basket-layout"><div className="basket-list">{lines.length ? lines.map(({ product, quantity }) => <article className="basket-item" key={product.id} data-testid={`row-basket-product-${product.id}`}><div className="basket-thumb">{product.imageUrls[0] ? <img src={product.imageUrls[0]} alt="" /> : <Package />}</div><div className="basket-info"><span className="eyebrow">{product.categoryName}</span><Link href={`/products/${product.slug}`}><b>{product.title}</b></Link><small>{money(product.priceUgx)}</small></div><div className="quantity-control"><button aria-label="Decrease quantity" onClick={() => update(lines.map((l) => l.product.id === product.id ? { ...l, quantity: Math.max(1, quantity - 1) } : l))}>−</button><span>{quantity}</span><button aria-label="Increase quantity" onClick={() => update(lines.map((l) => l.product.id === product.id ? { ...l, quantity: Math.min(100, quantity + 1) } : l))}>+</button></div><button className="remove-button" aria-label={`Remove ${product.title}`} onClick={() => update(lines.filter((l) => l.product.id !== product.id))} data-testid={`button-remove-${product.id}`}><X size={17} /></button></article>) : <div className="basket-empty"><div className="empty-mark"><ShoppingBasket size={28} /></div><div><h3>Your enquiry basket is empty.</h3><p>Browse the catalogue and add products you’d like to discuss.</p><Button href="/catalog" variant="outline">Explore catalogue <ArrowRight size={15} /></Button></div></div>}</div>{lines.length > 0 && <aside className="basket-summary"><span className="eyebrow">NEXT STEP</span><h2>Ready to ask?</h2><p>Send the items above with your contact details. A CRITS team member will follow up.</p>{whatsappBasketLink ? <a href={whatsappBasketLink} target="_blank" rel="noreferrer" className="button button-orange" data-testid="link-basket-whatsapp">Review quote message in WhatsApp <MessageCircle size={16} /></a> : <a href="#enquiry-form" className="button button-orange" data-testid="link-basket-enquiry">Continue to enquiry <ArrowDownToLine size={16} /></a>}<a href="#enquiry-form" className="basket-form-link">Use the enquiry form instead</a><div className="summary-note"><ShieldCheck size={18} /><span>No payment details needed.<br />This is a quote enquiry only.</span></div></aside>}</div>
    {lines.length > 0 && <div id="enquiry-form" className="basket-form"><ContactForm initialLines={lines} /></div>}
  </div></Shell>;
}
function About() {
  usePageMeta('About CRITS', 'Learn how the CRITS Limited catalogue and enquiry service works.');
  return <Shell><div className="site-width page-wrap page-enter"><div className="breadcrumb"><Link href="/">Home</Link><span>/</span><span>About</span></div><PageHeading kicker="ABOUT CRITS LIMITED" title="Business technology, clearly." copy="A clear, considered way to explore technology and business IT products." /><div className="story-grid"><div className="story-art"><div className="story-corner">CRITS<br /><span>LIMITED</span></div><div className="story-copy-art">Technology<br />for real work.</div><div className="story-rule" /></div><div className="story-text"><span className="eyebrow">THE WAY WE WORK</span><h2>Good decisions start with good information.</h2><p>CRITS Limited brings customers and technology products together through an experience that starts with an enquiry. Explore product information, make a shortlist, and speak with our team about what fits your requirements.</p><p>Product listings are added and reviewed by staff. We don’t publish a product until its details have been approved for the catalogue.</p><Button href="/catalog" variant="outline">Explore the catalogue <ArrowRight size={16} /></Button></div></div><section className="principles"><div><span>01</span><ShieldCheck /><h3>Clear product details</h3><p>Listings show the information approved for sharing, with questions welcomed.</p></div><div><span>02</span><Users /><h3>People in the loop</h3><p>Enquiries go to CRITS staff, not an anonymous checkout flow.</p></div><div><span>03</span><CheckCircle2 /><h3>Reviewed before release</h3><p>The public catalogue begins empty and grows as staff approve listings.</p></div></section></div><ContactBand /></Shell>;
}
function Services() {
  usePageMeta('Services', 'Explore CRITS Limited’s technology sourcing, IT equipment supply and business IT enquiry services.');
  const services = [
    ['01', 'Business technology sourcing', 'Tell us the job to be done. We can discuss suitable technology options and help you request a quote.', BriefcaseBusiness],
    ['02', 'IT equipment supply', 'Browse approved catalogue listings or ask our team about products that match your requirements.', HardDrive],
    ['03', 'Business IT guidance', 'Share your use case, environment and priorities so our team can understand what you need.', Headset],
    ['04', 'Quote enquiries', 'Build an enquiry basket or send a message directly. We’ll follow up using your preferred contact method.', ClipboardList],
  ] as const;
  return <Shell><div className="site-width page-wrap page-enter"><div className="breadcrumb"><Link href="/">Home</Link><span>/</span><span>Services</span></div><PageHeading kicker="WHAT WE DO" title="Technology support for the way you work." copy="Start with a product question or a business need. We’ll help you take the next step." /><div className="services-list">{services.map(([num, title, copy, Icon]) => <article className="service-row" key={num as string}><span className="service-num">{num as string}</span><Icon className="service-icon" /><div><h2>{title as string}</h2><p>{copy as string}</p></div><ArrowUpRight size={19} /></article>)}</div><div className="service-note"><LockKeyhole /><p><b>No checkout or payment collection.</b> This website is for browsing products and sending an enquiry to CRITS staff.</p></div></div><ContactBand /></Shell>;
}
function Privacy() {
  usePageMeta('Privacy notice', 'How CRITS Limited uses enquiry information and catalogue analytics.');
  return <Shell><div className="site-width page-wrap narrow-page page-enter"><div className="breadcrumb"><Link href="/">Home</Link><span>/</span><span>Privacy</span></div><PageHeading kicker="YOUR INFORMATION" title="Privacy notice." copy="How information submitted through this website is used." /><div className="legal-copy"><h2>Information you provide</h2><p>When you send an enquiry, we collect the details you enter, including your name, chosen contact method and contact detail, and any optional organisation, location or message information.</p><h2>How we use it</h2><p>CRITS Limited uses enquiry information to understand and respond to your request, including questions about products and quote enquiries. Enquiry basket items are included with your submission so we can respond with relevant context.</p><h2>Contact preference</h2><p>We use the contact method you select to follow up. Please provide contact details you are comfortable using for this purpose.</p><h2>How long records are kept</h2><p>A CRITS administrator can configure an enquiry retention period. When a period is set, enquiries older than that period may be permanently deleted automatically. If no period is set, the website does not automatically delete enquiry records. CRITS should confirm its retention period and applicable privacy requirements before launch.</p><h2>Catalogue activity</h2><p>Product views and catalogue searches may be recorded to help staff understand how the catalogue is being used. This activity does not publish your contact information.</p><h2>Questions</h2><p>For a privacy question, contact us at <a href={`mailto:${email}`}>{email}</a> or call {phoneMain}.</p><p className="legal-note">This notice describes the enquiry features available on this website. It is not legal advice.</p></div></div></Shell>;
}
const clerkAppearance = {
  theme: shadcn,
  cssLayerName: 'clerk',
  options: {
    logoPlacement: 'inside' as const,
    logoLinkUrl: basePath || '/',
    logoImageUrl: `${window.location.origin}${basePath}/crits-logo-transparent.png`,
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

function StaffAuthConfiguration() {
  return <main className="admin-gate"><div className="admin-gate-card"><Brand /><div className="denied-mark"><LockKeyhole /></div><span className="eyebrow">STAFF SIGN IN</span><h1>Staff access isn’t configured.</h1><p>The public catalogue is available. Add the Clerk development keys and an approved Clerk user ID to the private .env.local file, then restart the app to enable staff sign-in. Keep the secret key server-side.</p><Button href="/" variant="outline">Return to public website <ArrowRight size={16} /></Button></div></main>;
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
  usePageMeta('Staff workspace', 'Restricted CRITS Limited catalogue and enquiry administration.', undefined, true);
  const [tab, setTab] = useState<'overview' | 'products' | 'properties' | 'categories' | 'enquiries' | 'data' | 'settings'>('overview');
  const [productForm, setProductForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [propertyForm, setPropertyForm] = useState(false);
  const [editingProperty, setEditingProperty] = useState<Property | null>(null);
  const [prefillNalyaProperty, setPrefillNalyaProperty] = useState(false);
  const [propertyPage, setPropertyPage] = useState(1);
  const [propertySearch, setPropertySearch] = useState('');
  const [appliedPropertySearch, setAppliedPropertySearch] = useState('');
  const [propertyStatus, setPropertyStatus] = useState<'' | Property['status']>('');
  const [categoryForm, setCategoryForm] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [message, setMessage] = useState('');
  const [uploadedUrls, setUploadedUrls] = useState<string[]>([]);
  const [uploadedPropertyUrls, setUploadedPropertyUrls] = useState<string[]>([]);
  const [enquirySearch, setEnquirySearch] = useState('');
  const [enquiryStatus, setEnquiryStatus] = useState<'' | AdminEnquiry['status']>('');
  const [enquiryFrom, setEnquiryFrom] = useState('');
  const [enquiryTo, setEnquiryTo] = useState('');
  const [retentionDays, setRetentionDays] = useState('');
  const [retentionDisabled, setRetentionDisabled] = useState(true);
  const [retentionConfirmed, setRetentionConfirmed] = useState(false);
  const [settingsInitialized, setSettingsInitialized] = useState(false);
  const queryClient = useQueryClient();
  const access = useCheckAdminAccess({ query: { queryKey: getCheckAdminAccessQueryKey(), retry: false } });
  const allowed = !!access.data?.allowed;
  const overview = useGetAdminOverview({ query: { enabled: allowed, queryKey: getGetAdminOverviewQueryKey() } });
  const adminProducts = useListAdminProducts(undefined, { query: { enabled: allowed, queryKey: getListAdminProductsQueryKey() } });
  const adminPropertyPageSize = 10;
  const adminPropertyFilters = useMemo(() => ({
    q: appliedPropertySearch || undefined,
    status: propertyStatus || undefined,
    page: propertyPage,
    pageSize: adminPropertyPageSize,
  }), [appliedPropertySearch, propertyStatus, propertyPage]);
  const adminProperties = useListAdminProperties(adminPropertyFilters, { query: { enabled: allowed, queryKey: getListAdminPropertiesQueryKey(adminPropertyFilters) } });
  const adminPropertyTotal = adminProperties.data?.total ?? 0;
  const adminPropertyPageCount = Math.max(1, Math.ceil(adminPropertyTotal / adminPropertyPageSize));
  const adminPropertyItems = adminProperties.data?.items ?? [];
  useEffect(() => {
    if (propertyPage > adminPropertyPageCount) setPropertyPage(adminPropertyPageCount);
  }, [propertyPage, adminPropertyPageCount]);
  const adminCategories = useListAdminCategories({ query: { enabled: allowed, queryKey: getListAdminCategoriesQueryKey() } });
  const enquiryFilters = useMemo(() => ({
    q: enquirySearch.trim() || undefined,
    status: enquiryStatus || undefined,
    from: enquiryFrom ? new Date(`${enquiryFrom}T00:00:00`).toISOString() : undefined,
    to: enquiryTo ? new Date(`${enquiryTo}T23:59:59.999`).toISOString() : undefined,
  }), [enquirySearch, enquiryStatus, enquiryFrom, enquiryTo]);
  const adminEnquiries = useListAdminEnquiries(enquiryFilters, { query: { enabled: allowed, queryKey: getListAdminEnquiriesQueryKey(enquiryFilters) } });
  const adminSettings = useGetAdminSettings({ query: { enabled: allowed, queryKey: getGetAdminSettingsQueryKey() } });
  const createProduct = useCreateAdminProduct();
  const updateProduct = useUpdateAdminProduct();
  const createProperty = useCreateAdminProperty();
  const updateProperty = useUpdateAdminProperty();
  const importProducts = useImportAdminProducts();
  const createCategory = useCreateAdminCategory();
  const updateCategory = useUpdateAdminCategory();
  const updateEnquiry = useUpdateAdminEnquiry();
  const updateSettings = useUpdateAdminSettings();
  const uploadImage = useRequestProductImageUpload();
  const requestPropertyImageUpload = useRequestPropertyImageUpload();
  const refreshAdmin = () => Promise.all([
    queryClient.invalidateQueries({ queryKey: getGetAdminOverviewQueryKey() }),
    queryClient.invalidateQueries({ queryKey: getListAdminProductsQueryKey() }),
    queryClient.invalidateQueries({ queryKey: getListAdminPropertiesQueryKey() }),
    queryClient.invalidateQueries({ queryKey: getListPropertiesQueryKey() }),
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
      title: String(form.get('title')).trim(), slug: String(form.get('slug') || '').trim() || slugify(String(form.get('title'))), brand: String(form.get('brand') || '').trim() || null, model: String(form.get('model') || '').trim() || null,
      categoryId, condition: String(form.get('condition')) as ProductInput['condition'], description: String(form.get('description') || '').trim(),
      specifications: Object.fromEntries(specEntries.map((r) => [r[0].trim(), r.slice(1).join(':').trim()])), imageUrls: [...uploadedUrls, ...String(form.get('images') || '').split('\n').map((x) => x.trim()).filter(Boolean)].slice(0, 12),
      priceUgx: String(form.get('price') || '').trim() ? Number(form.get('price')) : null, availability: String(form.get('availability')) as ProductInput['availability'],
      stockQuantity: String(form.get('stock') || '').trim() ? Number(form.get('stock')) : null, sku: String(form.get('sku') || '').trim() || null,
      status: String(form.get('status')) as ProductInput['status'], featured: form.get('featured') === 'on',
    };
    if (input.status === 'published' && input.imageUrls.length === 0) {
      setMessage('Add a matching product photo before publishing this listing.');
      return;
    }
    const onSuccess = () => {
      setProductForm(false);
      setEditingProduct(null);
      setUploadedUrls([]);
      setMessage(editingProduct ? 'Product updated.' : 'Product saved.');
      void refreshAdmin();
    };
    const onError = () => setMessage('Product could not be saved. Review the product details and photos, then try again.');
    if (editingProduct) {
      updateProduct.mutate({ id: editingProduct.id, data: input }, { onSuccess, onError });
    } else {
      createProduct.mutate({ data: input }, { onSuccess, onError });
    }
  };
  const editCatalogueProduct = (product: Product) => {
    setEditingProduct(product);
    setUploadedUrls([]);
    setProductForm(true);
  };
  const changeProductStatus = (product: Product, status: ProductInput['status']) => {
    if (status === 'published' && product.imageUrls.length === 0) {
      setEditingProduct(product);
      setUploadedUrls([]);
      setProductForm(true);
      setMessage('Add a matching product photo, then save the listing to publish it.');
      return;
    }
    if (status === 'published' && !window.confirm(`Publish “${product.title}” to the public catalogue?`)) return;
    if (status === 'archived' && !window.confirm(`Archive “${product.title}”? It will no longer appear in the public catalogue.`)) return;
    updateProduct.mutate(
      { id: product.id, data: { status } },
      {
        onSuccess: () => { setMessage(`Product ${status === 'archived' ? 'archived' : status === 'draft' ? 'saved as a draft' : 'published'}.`); void refreshAdmin(); },
        onError: () => setMessage('Unable to update product status.'),
      },
    );
  };
  const submitProperty = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const title = String(form.get('title') || '').trim();
    const imageUrls = [...uploadedPropertyUrls, ...String(form.get('images') || '').split('\n').map((url) => url.trim()).filter(Boolean)].slice(0, 12);
    const input: PropertyInput = {
      title,
      slug: String(form.get('slug') || '').trim() || slugify(title),
      location: String(form.get('location') || '').trim(),
      landArea: String(form.get('landArea') || '').trim(),
      description: String(form.get('description') || '').trim(),
      imageUrls,
      priceUgx: String(form.get('price') || '').trim() ? Number(form.get('price')) : null,
      status: String(form.get('status')) as PropertyInput['status'],
      featured: form.get('featured') === 'on',
    };
    const onSuccess = () => {
      setPropertyForm(false);
      setEditingProperty(null);
      setPrefillNalyaProperty(false);
      setUploadedPropertyUrls([]);
      if (!editingProperty) {
        setPropertyPage(1);
        setPropertySearch('');
        setAppliedPropertySearch('');
        setPropertyStatus('');
      }
      setMessage(editingProperty ? 'Real estate listing updated.' : 'Real estate listing saved.');
      void refreshAdmin();
    };
    const onError = () => setMessage('Listing could not be saved. Review the title, location, source link and image URLs. Published listings need a property photo.');
    if (editingProperty) updateProperty.mutate({ id: editingProperty.id, data: input }, { onSuccess, onError });
    else createProperty.mutate({ data: input }, { onSuccess, onError });
  };
  const editPropertyListing = (property: Property) => {
    setEditingProperty(property);
    setPrefillNalyaProperty(false);
    setUploadedPropertyUrls([]);
    setPropertyForm(true);
  };
  const changePropertyStatus = (property: Property, status: PropertyInput['status']) => {
    if (status === 'published' && !window.confirm(`Publish "${property.title}" to the public real estate page?`)) return;
    if (status === 'archived' && !window.confirm(`Archive "${property.title}"? It will no longer appear publicly.`)) return;
    updateProperty.mutate({ id: property.id, data: { status } }, {
      onSuccess: () => { setMessage(`Listing ${status === 'archived' ? 'archived' : status === 'draft' ? 'saved as a draft' : 'published'}.`); void refreshAdmin(); },
      onError: () => setMessage('Unable to update listing status. Confirm it has a photo before publishing.'),
    });
  };
  const uploadPropertyImage = async (file?: File) => {
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { setMessage('Image must be 10 MB or smaller.'); return; }
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) { setMessage('Choose a JPG, PNG or WEBP image.'); return; }
    try {
      const requested = await requestPropertyImageUpload.mutateAsync({ data: { name: file.name, size: file.size, contentType: file.type as 'image/jpeg' | 'image/png' | 'image/webp' } });
      const response = await fetch(requested.uploadURL, { method: 'PUT', headers: { 'Content-Type': file.type }, body: file });
      if (!response.ok) throw new Error('Upload failed');
      setUploadedPropertyUrls((current) => [...current, requested.imageUrl].slice(0, 12));
      setMessage('Property photo uploaded and ready to save.');
    } catch { setMessage('Property photo upload failed. You can add a hosted image URL instead.'); }
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
      const rows = parseCsvDocument(await file.text());
      if (rows.length < 2) throw new Error('Add at least one product row after the header.');
      const headers = rows[0].map((value) => value.trim());
      if (new Set(headers).size !== headers.length) throw new Error('The CSV contains duplicate column names.');
      const required = ['title', 'categoryId', 'condition', 'availability'];
      if (required.some((header) => !headers.includes(header))) {
        throw new Error(`The CSV needs these columns: ${required.join(', ')}.`);
      }
      const imported: ProductInput[] = rows.slice(1).map((cells, index) => {
        const row = Object.fromEntries(headers.map((header, i) => [header, cells[i] ?? ''])) as Record<string, string>;
        const cell = (key: string) => row[key]?.trim() ?? '';
        const title = cell('title');
        const categoryId = Number(cell('categoryId'));
        const condition = cell('condition').toLowerCase() as ProductInput['condition'];
        const availability = cell('availability').toLowerCase() as ProductInput['availability'];
        if (!title || !Number.isSafeInteger(categoryId) || categoryId < 1) {
          throw new Error(`Row ${index + 2} needs a title and a positive categoryId.`);
        }
        if (!['new', 'used', 'refurbished'].includes(condition)) {
          throw new Error(`Row ${index + 2} needs condition new, used or refurbished.`);
        }
        if (!['available', 'quote', 'out_of_stock'].includes(availability)) {
          throw new Error(`Row ${index + 2} needs availability available, quote or out_of_stock.`);
        }
        if (row.status && !['draft', 'archived'].includes(row.status)) {
          throw new Error(`Row ${index + 2} must be draft or archived; imports cannot publish products.`);
        }
        const priceUgx = cell('priceUgx') ? Number(cell('priceUgx')) : null;
        const stockQuantity = cell('stockQuantity') ? Number(cell('stockQuantity')) : null;
        if (priceUgx !== null && (!Number.isSafeInteger(priceUgx) || priceUgx < 0)) {
          throw new Error(`Row ${index + 2} has an invalid UGX price.`);
        }
        if (stockQuantity !== null && (!Number.isSafeInteger(stockQuantity) || stockQuantity < 0)) {
          throw new Error(`Row ${index + 2} has an invalid stock quantity.`);
        }
        const featured = cell('featured').toLowerCase();
        if (featured && !['true', 'false'].includes(featured)) {
          throw new Error(`Row ${index + 2} needs featured to be true or false.`);
        }
        const status = cell('status').toLowerCase();
        if (status && !['draft', 'archived'].includes(status)) {
          throw new Error(`Row ${index + 2} must be draft or archived; imports cannot publish products.`);
        }
        return {
          title,
          slug: cell('slug') || slugify(title),
          brand: cell('brand') || null,
          model: cell('model') || null,
          categoryId,
          condition,
          description: cell('description'),
          specifications: parseJsonObject(cell('specifications')),
          imageUrls: parseJsonStringArray(cell('imageUrls')),
          priceUgx,
          availability,
          stockQuantity,
          sku: cell('sku') || null,
          status: status === 'archived' ? 'archived' : 'draft',
          featured: featured === 'true',
        };
      });
      if (!imported.length) throw new Error('There are no product rows to import.');
      if (!window.confirm(`Import ${imported.length} product record${imported.length === 1 ? '' : 's'} as drafts for staff review?`)) return;
      importProducts.mutate({ data: { products: imported } }, { onSuccess: (r) => { setMessage(`${r.imported} product records imported.`); void refreshAdmin(); }, onError: () => setMessage('Import failed. Check that your CSV matches the template and uses valid categories.') });
    } catch (error) {
      setMessage(error instanceof Error ? `CSV import stopped: ${error.message}` : 'Unable to read this CSV file.');
    }
  };
  const exportCsv = () => {
    const records = adminProducts.data || [];
    const cols = ['title', 'slug', 'brand', 'model', 'categoryId', 'condition', 'description', 'specifications', 'imageUrls', 'priceUgx', 'availability', 'stockQuantity', 'sku', 'status', 'featured'];
    const csv = [cols.map(escapeCsvCell).join(','), ...records.map((product) => {
      const row: Record<string, unknown> = {
        ...product,
        specifications: JSON.stringify(product.specifications ?? {}),
        imageUrls: JSON.stringify(product.imageUrls ?? []),
      };
      return cols.map((key) => escapeCsvCell(row[key])).join(',');
    })].join('\r\n');
    const url = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a'); a.href = url; a.download = 'crits-catalogue.csv'; a.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const exportPdf = async () => {
    const records = adminProducts.data || [];
    if (!records.length) return;
    try {
      const logoResponse = await fetch(base + '/crits-logo-transparent.png');
      if (!logoResponse.ok) throw new Error('CRITS logo could not be loaded');
      const logoBlob = await logoResponse.blob();
      const logoData = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = () => reject(new Error('CRITS logo could not be read'));
        reader.onload = () => typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('CRITS logo could not be read'));
        reader.readAsDataURL(logoBlob);
      });
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 16;
      const textWidth = pageWidth - margin * 2;
      const contentBottom = pageHeight - 24;
      const navy: [number, number, number] = [36, 72, 100];
      const orange: [number, number, number] = [216, 91, 50];
      const gray: [number, number, number] = [105, 121, 134];
      const ink: [number, number, number] = [43, 56, 67];
      const preparedOn = new Date().toLocaleDateString('en-UG');
      let y = 37;

      pdf.setProperties({
        title: 'CRITS Limited product catalogue',
        subject: 'Product catalogue export',
        author: 'CRITS Limited',
        creator: 'CRITS Online Shop',
      });

      const nextPage = () => {
        pdf.addPage();
        y = 37;
      };
      const ensureSpace = (height: number) => {
        if (y + height > contentBottom) nextPage();
      };
      const writeText = (
        value: string,
        size: number,
        style: 'normal' | 'bold',
        color: [number, number, number],
        gapAfter = 1.5,
      ) => {
        if (!value) return;
        pdf.setFont('helvetica', style);
        pdf.setFontSize(size);
        pdf.setTextColor(color[0], color[1], color[2]);
        const lines = pdf.splitTextToSize(value, textWidth) as string[];
        const lineHeight = size * 0.48;
        for (const line of lines) {
          ensureSpace(lineHeight);
          pdf.text(line, margin, y);
          y += lineHeight;
        }
        y += gapAfter;
      };

      records.forEach((product, index) => {
        if (index > 0) {
          ensureSpace(9);
          pdf.setDrawColor(220, 227, 231);
          pdf.line(margin, y, pageWidth - margin, y);
          y += 7;
        }
        writeText(product.title || 'Untitled product', 12, 'bold', navy, 1);
        writeText(money(product.priceUgx) + '  |  ' + human(product.status), 9, 'bold', orange, 2.5);

        const details: Array<[string, string]> = [
          ['Category', product.categoryName],
          ['Brand', product.brand || ''],
          ['Model', product.model || ''],
          ['SKU', product.sku || ''],
          ['Condition', human(product.condition)],
          ['Availability', human(product.availability)],
          ['Stock quantity', product.stockQuantity == null ? '' : String(product.stockQuantity)],
          ['Featured', product.featured ? 'Yes' : 'No'],
        ];
        for (const [label, value] of details) {
          if (value) writeText(label + ': ' + value, 9, 'normal', ink, 0.5);
        }

        y += 1;
        writeText('Description', 9, 'bold', navy, 1);
        writeText(product.description || 'No description provided.', 9, 'normal', ink, 2);

        const specifications = Object.entries(product.specifications || {});
        if (specifications.length) {
          writeText('Specifications', 9, 'bold', navy, 1);
          for (const [key, value] of specifications) {
            writeText(key + ': ' + value, 9, 'normal', ink, 0.5);
          }
        }
        y += 3;
      });

      const pageCount = pdf.getNumberOfPages();
      for (let page = 1; page <= pageCount; page += 1) {
        pdf.setPage(page);
        pdf.setFillColor(orange[0], orange[1], orange[2]);
        pdf.rect(0, 0, pageWidth, 3, 'F');
        pdf.addImage(logoData, 'PNG', margin, 6, 56, 12.2);
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(7.5);
        pdf.setTextColor(navy[0], navy[1], navy[2]);
        pdf.text('CANDID REALTORS & IT SOLUTIONS LIMITED', pageWidth - margin, 7.5, { align: 'right' });
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(7.5);
        pdf.text('0200 901 530  |  0756 501 530  |  0393 243 318', pageWidth - margin, 14, { align: 'right' });
        pdf.setTextColor(gray[0], gray[1], gray[2]);
        pdf.text('fairpricesolutions03@gmail.com', pageWidth - margin, 20, { align: 'right' });
        pdf.setDrawColor(220, 227, 231);
        pdf.line(margin, 27, pageWidth - margin, 27);
        pdf.line(margin, pageHeight - 18, pageWidth - margin, pageHeight - 18);
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(7.5);
        pdf.setTextColor(gray[0], gray[1], gray[2]);
        pdf.text('Admin export  |  Prepared ' + preparedOn, margin, pageHeight - 11);
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(9);
        pdf.setTextColor(orange[0], orange[1], orange[2]);
        pdf.text('Quality Redefined', pageWidth / 2, pageHeight - 11, { align: 'center' });
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(7.5);
        pdf.setTextColor(gray[0], gray[1], gray[2]);
        pdf.text('Page ' + page + ' of ' + pageCount, pageWidth - margin, pageHeight - 11, { align: 'right' });
      }

      pdf.save('crits-product-catalogue-' + new Date().toISOString().slice(0, 10) + '.pdf');
      setMessage('Catalogue PDF downloaded.');
    } catch {
      setMessage('The catalogue PDF could not be generated. Please try again.');
    }
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
  const tabs: { id: typeof tab; name: string; icon: typeof LayoutDashboard }[] = [{ id: 'overview', name: 'Overview', icon: LayoutDashboard }, { id: 'products', name: 'Products', icon: Package }, { id: 'properties', name: 'Real estate', icon: Building2 }, { id: 'categories', name: 'Categories', icon: Tag }, { id: 'enquiries', name: 'Enquiries', icon: MessageCircle }, { id: 'data', name: 'Import / export', icon: FileText }, { id: 'settings', name: 'Privacy settings', icon: LockKeyhole }];
  return <main className="admin-layout">
    <aside className="admin-sidebar"><Brand inverse /><div className="admin-brand-caption">STAFF WORKSPACE</div><div className="admin-side-label">MANAGE</div><nav>{tabs.map(({ id, name, icon: Icon }) => <button key={id} onClick={() => { setTab(id); setMessage(''); }} className={tab === id ? 'selected' : ''} data-testid={`button-admin-tab-${id}`}><Icon size={18} />{name}{id === 'enquiries' && !!overview.data?.openEnquiryCount && <span className="side-count">{overview.data.openEnquiryCount}</span>}</button>)}</nav><div className="admin-sidebar-bottom"><Link href="/" data-testid="link-admin-public"><ArrowLeft size={15} /> Public website</Link><span><ShieldCheck size={16} /> Restricted staff access</span></div></aside>
    <section className="admin-main"><header className="admin-topbar"><div><span className="admin-mobile-brand">CRITS / </span><span>Staff workspace</span><span className="admin-divider">/</span><b>{tabs.find((x) => x.id === tab)?.name}</b></div><Link href="/" className="admin-view-site">View public site <ArrowUpRight size={15} /></Link></header><div className="admin-content">
      {message && <div className="admin-flash" role="status" data-testid="status-admin-message"><CheckCircle2 size={17} />{message}<button onClick={() => setMessage('')} aria-label="Dismiss message"><X size={16} /></button></div>}
      {tab === 'overview' && <><div className="admin-title-row"><div><span className="eyebrow">CRITS LIMITED · OPERATIONS</span><h1>Good day. Here’s the overview.</h1><p>Catalogue and customer activity at a glance.</p></div></div>{overview.isLoading ? <div className="metric-grid">{[1, 2, 3, 4].map((n) => <div className="metric-card" key={n}><div className="skeleton-line short" /><div className="skeleton-line" /></div>)}</div> : overview.isError ? <QueryFailure retry={() => overview.refetch()} /> : overview.data && <><div className="metric-grid">{[{ label: 'Product records', value: overview.data.productCount, icon: Package }, { label: 'Published', value: overview.data.publishedCount, icon: BadgeCheck }, { label: 'Total enquiries', value: overview.data.enquiryCount, icon: MessageCircle }, { label: 'Open enquiries', value: overview.data.openEnquiryCount, icon: Clock3 }, { label: 'Product views', value: overview.data.productViews, icon: ArrowUpRight }, { label: 'Catalogue searches', value: overview.data.searches, icon: Search }].map(({ label, value, icon: Icon }) => <div className="metric-card" key={label}><div><span>{label}</span><Icon size={18} /></div><strong data-testid={`text-metric-${slugify(label)}`}>{value}</strong></div>)}</div><div className="admin-dashboard-grid"><section className="admin-panel"><div className="panel-title"><div><span className="eyebrow">CUSTOMER ACTIVITY</span><h2>Recent enquiries</h2></div><button className="text-button" onClick={() => setTab('enquiries')}>View all <ArrowRight size={14} /></button></div>{overview.data.recentEnquiries.length ? overview.data.recentEnquiries.map((enq) => <EnquirySummary key={enq.id} enquiry={enq} />) : <AdminEmpty icon={MessageCircle} title="No enquiries yet" copy="New product and contact enquiries will appear here." />}</section><section className="admin-panel"><div className="panel-title"><div><span className="eyebrow">CATALOGUE ACTIVITY</span><h2>Most viewed listings</h2></div><button className="text-button" onClick={() => setTab('products')}>Manage products <ArrowRight size={14} /></button></div>{overview.data.topProducts.length ? overview.data.topProducts.map((p) => <div className="top-product" key={p.id}><div className="mini-product-img">{p.imageUrls[0] ? <img src={p.imageUrls[0]} alt="" /> : <Package size={17} />}</div><div><b>{p.title}</b><small>{p.categoryName}</small></div><span>{p.viewCount} views</span></div>) : <AdminEmpty icon={Package} title="No product activity" copy="Published products and their views will appear here." />}</section></div></>}</>}
      {tab === 'products' && <><div className="admin-title-row"><div><span className="eyebrow">CATALOGUE MANAGEMENT</span><h1>Products</h1><p>Maintain approved product information and publication status.</p></div><button className="button button-primary" onClick={() => { setProductForm(!productForm); setEditingProduct(null); setUploadedUrls([]); }} data-testid="button-create-product"><Plus size={16} /> Add product</button></div>
        {productForm && <form key={editingProduct?.id ?? 'new-product'} className="admin-form-card" onSubmit={createProductSubmit}><div className="panel-title"><div><h2>{editingProduct ? `Edit ${editingProduct.title}` : 'Add catalogue product'}</h2><p>Only add products approved for publication.</p></div><button type="button" className="icon-button" onClick={() => { setProductForm(false); setEditingProduct(null); setUploadedUrls([]); }} aria-label="Close form"><X size={18} /></button></div><div className="admin-form-grid">
          <label>Product title<input name="title" required maxLength={220} defaultValue={editingProduct?.title ?? ''} data-testid="input-admin-product-title" /></label>
          <label>URL slug<input name="slug" maxLength={180} defaultValue={editingProduct?.slug ?? ''} placeholder="Created from title if left blank" /></label>
          <label>Category<select name="categoryId" required defaultValue={editingProduct?.categoryId ?? ''}><option value="" disabled>Select category</option>{adminCategories.data?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
          <label>Brand<input name="brand" defaultValue={editingProduct?.brand ?? ''} /></label>
          <label>Model<input name="model" defaultValue={editingProduct?.model ?? ''} /></label>
          <label>Condition<select name="condition" defaultValue={editingProduct?.condition ?? 'new'}><option value="new">New</option><option value="used">Used</option><option value="refurbished">Refurbished</option></select></label>
          <label>Availability<select name="availability" defaultValue={editingProduct?.availability ?? 'quote'}><option value="quote">Quote required</option><option value="available">Available</option><option value="out_of_stock">Out of stock</option></select></label>
          <label>Price (UGX)<input name="price" type="number" min="0" step="1" defaultValue={editingProduct?.priceUgx ?? ''} /></label>
          <label>Stock quantity<input name="stock" type="number" min="0" step="1" defaultValue={editingProduct?.stockQuantity ?? ''} /></label>
          <label>SKU<input name="sku" defaultValue={editingProduct?.sku ?? ''} /></label>
          <label className="wide">Description<textarea name="description" rows={3} defaultValue={editingProduct?.description ?? ''} /></label>
          <label className="wide">Specifications <small>One per line: Key: value</small><textarea name="specifications" rows={3} defaultValue={editingProduct ? Object.entries(editingProduct.specifications).map(([key, value]) => `${key}: ${value}`).join('\n') : ''} placeholder={'Memory: 16 GB\\nStorage: 512 GB'} /></label>
          <label className="wide">Image URLs <small>One URL per line · new uploads: {uploadedUrls.length}</small><textarea name="images" rows={2} defaultValue={editingProduct?.imageUrls.join('\n') ?? ''} /></label>
          <label className="wide image-upload-label">Upload product image <input type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => void uploadProductImage(e.target.files?.[0])} data-testid="input-product-image-upload" /><small>{uploadImage.isPending ? 'Preparing secure upload…' : 'JPEG, PNG or WEBP · up to 10 MB'}</small></label>
          {!(editingProduct?.imageUrls.length || uploadedUrls.length) && <div className="wide admin-photo-guidance"><Package size={18} /><span><b>Product photo needed.</b> Upload a matching photo from the CRITS listing before publishing. A reference link does not automatically import its photo.</span></div>}
          {!!(editingProduct?.imageUrls.length || uploadedUrls.length) && <div className="wide product-upload-preview">{[...(editingProduct?.imageUrls ?? []), ...uploadedUrls].map((url) => <img key={url} src={url} alt="Product photo preview" loading="lazy" />)}</div>}
          <label>Publication status<select name="status" defaultValue={editingProduct?.status ?? 'draft'}><option value="draft">Draft</option><option value="published">Published</option><option value="archived">Archived</option></select></label>
          <label className="check-field"><input type="checkbox" name="featured" defaultChecked={editingProduct?.featured ?? false} /> Feature on public home</label>
        </div><button className="button button-primary" type="submit" disabled={createProduct.isPending || updateProduct.isPending || uploadImage.isPending}>{createProduct.isPending || updateProduct.isPending ? 'Saving…' : editingProduct ? 'Update product' : 'Save product'} <Check size={15} /></button></form>}
        <div className="admin-panel table-panel"><div className="panel-title"><div><span className="eyebrow">ALL RECORDS</span><h2>Catalogue</h2></div><div className="catalog-export-actions"><Button onClick={exportCsv} variant="outline" disabled={!adminProducts.data?.length}><ArrowDownToLine size={15} /> Export CSV</Button><Button onClick={exportPdf} variant="outline" disabled={!adminProducts.data?.length}><FileText size={15} /> Export PDF</Button></div></div>{adminProducts.isLoading ? <div className="skeleton-table" /> : adminProducts.isError ? <QueryFailure retry={() => adminProducts.refetch()} /> : adminProducts.data?.length ? <div className="table-scroll"><table><thead><tr><th>Product</th><th>Photo</th><th>Category</th><th>Condition</th><th>Status</th><th>Availability</th><th>Actions</th></tr></thead><tbody>{adminProducts.data.map((p) => <tr key={p.id} data-testid={`row-admin-product-${p.id}`}><td><b>{p.title}</b><small>{p.brand || p.model || p.sku || 'Not provided'}</small></td><td><span className={p.imageUrls.length ? 'admin-photo-present' : 'admin-photo-needed'}>{p.imageUrls.length ? `${p.imageUrls.length} photo${p.imageUrls.length === 1 ? '' : 's'}` : 'Photo needed · Edit to upload'}</span></td><td>{p.categoryName}</td><td>{human(p.condition)}</td><td><StatusPill value={p.status} /></td><td>{human(p.availability)}</td><td><div className="admin-row-actions"><button className="small-action" onClick={() => editCatalogueProduct(p)} data-testid={`button-edit-product-${p.id}`}>Edit</button>{p.status === 'published' ? <button className="small-action" onClick={() => changeProductStatus(p, 'draft')} data-testid={`button-unpublish-product-${p.id}`}>Unpublish</button> : p.status === 'archived' ? <button className="small-action" onClick={() => changeProductStatus(p, 'draft')} data-testid={`button-restore-product-${p.id}`}>Restore</button> : <button className="small-action" onClick={() => changeProductStatus(p, 'published')} data-testid={`button-publish-product-${p.id}`}>Publish</button>}{p.status !== 'archived' && <button className="small-action danger-action" onClick={() => changeProductStatus(p, 'archived')}>Archive</button>}</div></td></tr>)}</tbody></table></div> : <AdminEmpty icon={Package} title="No product records yet" copy="Create an approved product record to begin building the catalogue." action={<button className="text-button" onClick={() => setProductForm(true)}>Add a product <Plus size={15} /></button>} />}</div>
      </>}
      {tab === 'properties' && <><div className="admin-title-row"><div><span className="eyebrow">REAL ESTATE MANAGEMENT</span><h1>Property listings</h1><p>Add and maintain land opportunities for the public Real Estate page.</p></div><button className="button button-primary" onClick={() => { setPropertyForm(!propertyForm); setEditingProperty(null); setPrefillNalyaProperty(false); setUploadedPropertyUrls([]); }} data-testid="button-create-property"><Plus size={16} /> Add listing</button></div>
        {propertyForm && <form key={editingProperty?.id ?? (prefillNalyaProperty ? 'seed-nalya-property' : 'new-property')} className="admin-form-card" onSubmit={submitProperty}><div className="panel-title"><div><h2>{editingProperty ? `Edit ${editingProperty.title}` : prefillNalyaProperty ? 'Set up Naalya property listing' : 'Add real estate listing'}</h2><p>Published listings appear on the public Real Estate page. Add a matching photo before publishing.</p></div><button type="button" className="icon-button" onClick={() => { setPropertyForm(false); setEditingProperty(null); setPrefillNalyaProperty(false); setUploadedPropertyUrls([]); }} aria-label="Close form"><X size={18} /></button></div><div className="admin-form-grid">
          <label>Listing title<input name="title" required maxLength={220} defaultValue={editingProperty?.title ?? (prefillNalyaProperty ? nalyaPropertyListing.title : '')} data-testid="input-admin-property-title" /></label>
          <label>URL slug<input name="slug" maxLength={180} defaultValue={editingProperty?.slug ?? (prefillNalyaProperty ? nalyaPropertyListing.slug : '')} placeholder="Created from title if left blank" /></label>
          <label>Location<input name="location" required maxLength={240} defaultValue={editingProperty?.location ?? (prefillNalyaProperty ? nalyaPropertyListing.location : '')} /></label>
          <label>Land area<input name="landArea" required maxLength={80} defaultValue={editingProperty?.landArea ?? (prefillNalyaProperty ? nalyaPropertyListing.landArea : '')} /></label>
          <label>Price (UGX)<input name="price" type="number" min="0" step="1" defaultValue={editingProperty?.priceUgx ?? (prefillNalyaProperty ? nalyaPropertyListing.priceUgx ?? '' : '')} /></label>
          <label className="wide">Description<textarea name="description" rows={3} maxLength={10000} defaultValue={editingProperty?.description ?? (prefillNalyaProperty ? nalyaPropertyListing.description : '')} placeholder="Property details for public display" /></label>
          <label className="wide">Photo URLs <small>One per line · uploaded photos: {uploadedPropertyUrls.length}</small><textarea name="images" rows={2} defaultValue={editingProperty?.imageUrls.join('\n') ?? ''} placeholder="Paste hosted image URLs or upload property photos" /></label>
          <label className="wide image-upload-label">Upload property photo <input type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => void uploadPropertyImage(e.target.files?.[0])} data-testid="input-property-image-upload" /><small>{requestPropertyImageUpload.isPending ? 'Preparing secure upload…' : 'JPG, PNG or WEBP · up to 10 MB. Use the photo from the matching listing.'}</small></label>
          {!!uploadedPropertyUrls.length && <div className="wide property-upload-preview">{uploadedPropertyUrls.map((url) => <img key={url} src={url} alt="Uploaded property preview" />)}</div>}
          <label>Publication status<select name="status" defaultValue={editingProperty?.status ?? 'draft'}><option value="draft">Draft</option><option value="published">Published</option><option value="archived">Archived</option></select></label>
          <label className="check-field"><input type="checkbox" name="featured" defaultChecked={editingProperty?.featured ?? prefillNalyaProperty} /> Feature on Real Estate page</label>
        </div><button className="button button-primary" type="submit" disabled={createProperty.isPending || updateProperty.isPending || requestPropertyImageUpload.isPending}>{createProperty.isPending || updateProperty.isPending ? 'Saving…' : editingProperty ? 'Update listing' : 'Save listing'} <Check size={15} /></button></form>}
        <div className="admin-panel table-panel property-admin-panel"><div className="panel-title"><div><span className="eyebrow">ALL RECORDS</span><h2>Real estate listings</h2></div></div>
          <form className="property-admin-filters" onSubmit={(e) => { e.preventDefault(); setAppliedPropertySearch(propertySearch.trim()); setPropertyPage(1); }}>
            <label>Search properties<input value={propertySearch} onChange={(e) => setPropertySearch(e.target.value)} placeholder="Title, location or land area" /></label>
            <label>Status<select value={propertyStatus} onChange={(e) => { setPropertyStatus(e.target.value as typeof propertyStatus); setPropertyPage(1); }}><option value="">All statuses</option><option value="published">Published</option><option value="draft">Draft</option><option value="archived">Archived</option></select></label>
            <button className="button button-outline" type="submit"><Search size={15} /> Search</button>
            {(appliedPropertySearch || propertyStatus) && <button type="button" className="text-button" onClick={() => { setPropertySearch(''); setAppliedPropertySearch(''); setPropertyStatus(''); setPropertyPage(1); }}>Clear filters <X size={14} /></button>}
          </form>
          {adminProperties.isLoading ? <div className="skeleton-table" /> : adminProperties.isError ? <QueryFailure retry={() => adminProperties.refetch()} /> : adminPropertyItems.length ? <>
            <div className="table-scroll"><table><thead><tr><th>Property</th><th>Area</th><th>Price</th><th>Status</th><th>Actions</th></tr></thead><tbody>{adminPropertyItems.map((property) => <tr key={property.id} data-testid={`row-admin-property-${property.id}`}><td><div className="property-admin-name">{property.imageUrls[0] ? <img src={property.imageUrls[0]} alt="" /> : <Building2 size={20} />}<div><b>{property.title}</b><small>{property.location}</small>{!property.imageUrls.length && <small className="admin-photo-needed">Photo needed before publishing</small>}</div></div></td><td>{property.landArea}</td><td>{money(property.priceUgx)}</td><td><StatusPill value={property.status} /></td><td><div className="admin-row-actions"><button className="small-action" onClick={() => editPropertyListing(property)} data-testid={`button-edit-property-${property.id}`}>Edit</button>{property.status === 'published' ? <button className="small-action" onClick={() => changePropertyStatus(property, 'draft')}>Unpublish</button> : property.status === 'archived' ? <button className="small-action" onClick={() => changePropertyStatus(property, 'draft')}>Restore</button> : <button className="small-action" onClick={() => changePropertyStatus(property, 'published')}>Publish</button>}{property.status !== 'archived' && <button className="small-action danger-action" onClick={() => changePropertyStatus(property, 'archived')}>Archive</button>}</div></td></tr>)}</tbody></table></div>
            <div className="property-result-bar"><span>Showing {(propertyPage - 1) * adminPropertyPageSize + 1} to {Math.min(propertyPage * adminPropertyPageSize, adminPropertyTotal)} of {adminPropertyTotal} listings</span><span>Page {propertyPage} of {adminPropertyPageCount}</span></div>
            {adminPropertyPageCount > 1 && <nav className="catalog-pagination" aria-label="Admin property listings pagination"><button type="button" className="pagination-step" onClick={() => setPropertyPage((page) => Math.max(1, page - 1))} disabled={propertyPage <= 1}>Previous</button>{pageSequence(propertyPage, adminPropertyPageCount).map((item, index) => item === 'ellipsis' ? <span key={`admin-ellipsis-${index}`} className="pagination-ellipsis" aria-hidden="true">…</span> : <button type="button" key={item} className="pagination-number" onClick={() => setPropertyPage(item)} aria-label={`Go to property page ${item}`} aria-current={propertyPage === item ? 'page' : undefined}>{item}</button>)}<button type="button" className="pagination-step" onClick={() => setPropertyPage((page) => Math.min(adminPropertyPageCount, page + 1))} disabled={propertyPage >= adminPropertyPageCount}>Next</button></nav>}
          </> : <AdminEmpty icon={Building2} title={appliedPropertySearch || propertyStatus ? 'No listings match these filters' : 'No saved property listings yet'} copy={appliedPropertySearch || propertyStatus ? 'Try a broader search or clear the filters.' : 'The public page currently features the Naalya opportunity. Prepare it here to save and manage it as a regular listing.'} action={appliedPropertySearch || propertyStatus ? <button className="text-button" onClick={() => { setPropertyForm(true); setEditingProperty(null); setPrefillNalyaProperty(false); setUploadedPropertyUrls([]); }}>Add a property <Plus size={15} /></button> : <div className="property-admin-empty-actions"><button className="button button-primary" onClick={() => { setPropertyForm(true); setEditingProperty(null); setPrefillNalyaProperty(true); setUploadedPropertyUrls([]); }}>Prepare Naalya listing <Plus size={15} /></button><button className="text-button" onClick={() => { setPropertyForm(true); setEditingProperty(null); setPrefillNalyaProperty(false); setUploadedPropertyUrls([]); }}>Add a different property <Plus size={15} /></button></div>} />}
        </div>
      </>}
      {tab === 'categories' && <><div className="admin-title-row"><div><span className="eyebrow">CATALOGUE ORGANISATION</span><h1>Categories</h1><p>Keep product groups useful and easy to browse.</p></div><button className="button button-primary" onClick={() => { setCategoryForm(!categoryForm); setEditingCategory(null); }} data-testid="button-create-category"><Plus size={16} /> Add category</button></div>
        {categoryForm && <CategoryForm key={editingCategory?.id ?? 'new-category'} initial={editingCategory ?? undefined} pending={createCategory.isPending || updateCategory.isPending} onCancel={() => { setCategoryForm(false); setEditingCategory(null); }} onSubmit={(data) => {
          const onSuccess = () => { setCategoryForm(false); setEditingCategory(null); setMessage(editingCategory ? 'Category updated.' : 'Category created.'); void refreshAdmin(); };
          const onError = () => setMessage('Category could not be saved. Check the name and slug.');
          if (editingCategory) updateCategory.mutate({ id: editingCategory.id, data }, { onSuccess, onError });
          else createCategory.mutate({ data }, { onSuccess, onError });
        }} />}
        {adminCategories.isLoading ? <div className="skeleton-table" /> : adminCategories.isError ? <QueryFailure retry={() => adminCategories.refetch()} /> : adminCategories.data?.length ? <div className="category-admin-list">{adminCategories.data.map((c) => <div className="category-admin-row" key={c.id} data-testid={`row-admin-category-${c.id}`}><div className="category-admin-icon"><Tag /></div><div className="category-admin-info"><b>{c.name}</b><span>/{c.slug} · ID {c.id} · {c.productCount} products</span><small>{c.description || 'No description'}</small></div><StatusPill value={c.active ? 'active' : 'inactive'} /><div className="category-row-actions"><button className="small-action" onClick={() => { setEditingCategory(c); setCategoryForm(true); }} data-testid={`button-edit-category-${c.id}`}>Edit</button><button className="small-action" onClick={() => updateCategory.mutate({ id: c.id, data: { active: !c.active } }, { onSuccess: () => { setMessage(`Category ${c.active ? 'deactivated' : 'activated'}.`); void refreshAdmin(); }, onError: () => setMessage('Unable to update category.') })} data-testid={`button-toggle-category-${c.id}`}>{c.active ? 'Deactivate' : 'Activate'}</button></div></div>)}</div> : <AdminEmpty icon={Tag} title="No categories yet" copy="Add categories before creating product records." action={<button className="text-button" onClick={() => setCategoryForm(true)}>Create category <Plus size={15} /></button>} />}
      </>}
      {tab === 'enquiries' && <><div className="admin-title-row"><div><span className="eyebrow">CUSTOMER MESSAGES</span><h1>Enquiries</h1><p>Review quote requests and keep each response moving.</p></div></div>
        <form className="enquiry-filters" onSubmit={(e) => e.preventDefault()}>
          <label>Search contact or reference<input value={enquirySearch} onChange={(e) => setEnquirySearch(e.target.value)} placeholder="Name, phone, email or reference" /></label>
          <label>Status<select value={enquiryStatus} onChange={(e) => setEnquiryStatus(e.target.value as typeof enquiryStatus)}><option value="">All statuses</option><option value="new">New</option><option value="in_progress">In progress</option><option value="replied">Replied</option><option value="closed">Closed</option></select></label>
          <label>From<input type="date" value={enquiryFrom} onChange={(e) => setEnquiryFrom(e.target.value)} /></label>
          <label>To<input type="date" value={enquiryTo} onChange={(e) => setEnquiryTo(e.target.value)} /></label>
          {(enquirySearch || enquiryStatus || enquiryFrom || enquiryTo) && <button type="button" className="text-button" onClick={() => { setEnquirySearch(''); setEnquiryStatus(''); setEnquiryFrom(''); setEnquiryTo(''); }}>Clear filters <X size={14} /></button>}
        </form>
        {enquiryFrom && enquiryTo && enquiryFrom > enquiryTo ? <div className="form-error" role="alert">The start date must be on or before the end date.</div> : adminEnquiries.isLoading ? <div className="skeleton-table" /> : adminEnquiries.isError ? <QueryFailure retry={() => adminEnquiries.refetch()} /> : adminEnquiries.data?.length ? <div className="enquiry-admin-list">{adminEnquiries.data.map((e) => <EnquiryAdminCard key={e.id} enquiry={e} onUpdate={(data) => updateEnquiry.mutate({ id: e.id, data }, { onSuccess: () => { setMessage(`Enquiry ${e.reference} updated.`); void refreshAdmin(); }, onError: () => setMessage('Enquiry update failed.') })} pending={updateEnquiry.isPending} />)}</div> : <AdminEmpty icon={MessageCircle} title={enquirySearch || enquiryStatus || enquiryFrom || enquiryTo ? 'No enquiries match these filters' : 'No enquiries received yet'} copy={enquirySearch || enquiryStatus || enquiryFrom || enquiryTo ? 'Try a broader search or remove some filters.' : 'Customer product and contact requests will appear here.'} />}
      </>}
      {tab === 'data' && <><div className="admin-title-row"><div><span className="eyebrow">CATALOGUE DATA</span><h1>Import & export</h1><p>Move product information in or out of the CRITS catalogue.</p></div></div><div className="data-tools"><section className="data-tool-card"><div className="tool-icon"><Upload /></div><span className="eyebrow">BATCH IMPORT</span><h2>Import product CSV</h2><p>Use the empty template. Include the current category ID, JSON object specifications, and JSON array image URLs. Imports create drafts or archived records for staff review, never published listings.</p><a className="button button-outline" href={`${base}/product-catalogue-template.csv`} download><ArrowDownToLine size={16} /> Download template</a><label className="file-picker"><input type="file" accept=".csv,text/csv" onChange={(e) => void importCsv(e.target.files?.[0])} data-testid="input-import-csv" /><Upload size={16} /> Choose CSV file</label>{importProducts.isPending && <p className="pending-note">Validating and importing…</p>}</section><section className="data-tool-card"><div className="tool-icon"><ArrowDownToLine /></div><span className="eyebrow">BACKUP / REVIEW</span><h2>Export catalogue</h2><p>Download a CSV or PDF directly. The PDF is generated in your browser. Source URLs and customer enquiry details are excluded.</p><div className="catalog-export-actions"><Button onClick={exportCsv} variant="outline" disabled={!adminProducts.data?.length}><ArrowDownToLine size={16} /> Download CSV</Button><Button onClick={exportPdf} variant="outline" disabled={!adminProducts.data?.length}><FileText size={16} /> Export PDF</Button></div></section></div><div className="admin-note"><ShieldCheck /><p><b>Keep catalogue details accurate.</b> Only import product information approved by CRITS staff. Imported records remain out of the public catalogue until a staff member publishes them.</p></div></>}
      {tab === 'settings' && <><div className="admin-title-row"><div><span className="eyebrow">PRIVACY CONTROLS</span><h1>Enquiry retention</h1><p>Configure how long customer enquiry records are retained.</p></div></div>
        {adminSettings.isLoading ? <div className="admin-panel"><div className="skeleton-line" /><div className="skeleton-line short" /></div> : adminSettings.isError ? <QueryFailure retry={() => adminSettings.refetch()} /> : adminSettings.data && <div className="retention-layout"><form className="retention-panel" onSubmit={saveRetentionSettings}>
          <div className="retention-panel-heading"><span className="retention-icon"><LockKeyhole /></span><div><span className="eyebrow">ENQUIRY RECORDS</span><h2>Automatic deletion</h2><p>Choose a retention period for enquiries submitted through the website.</p></div></div>
          <label className="retention-toggle"><input type="checkbox" checked={retentionDisabled} onChange={(e) => { setRetentionDisabled(e.target.checked); setRetentionConfirmed(false); if (e.target.checked) setRetentionDays(''); }} data-testid="checkbox-retention-disabled" /><span><b>Disable automatic deletion</b><small>No retention period is set. Enquiry records are not automatically deleted.</small></span></label>
          <label className="retention-days-field">Retention period in days<input type="number" min={1} max={3650} step={1} value={retentionDays} disabled={retentionDisabled} onChange={(e) => { setRetentionDays(e.target.value); setRetentionConfirmed(false); }} placeholder="Enter from 1 to 3650 days" data-testid="input-retention-days" /></label>
          <div className="retention-warning" role="note"><CircleHelp /><div><b>Important: this setting can permanently delete enquiry records.</b><p>When a retention period is set, older enquiries may be permanently removed. Confirm the period is appropriate before saving.</p></div></div>
          <label className="retention-confirm"><input type="checkbox" checked={retentionConfirmed} onChange={(e) => setRetentionConfirmed(e.target.checked)} data-testid="checkbox-retention-confirm" /><span>I understand changing this setting may permanently delete older enquiry records.</span></label>
          <div className="retention-actions"><span>{adminSettings.data.updatedAt ? `Last updated ${new Date(adminSettings.data.updatedAt).toLocaleString()}` : 'No previous update recorded'}</span><button className="button button-primary" type="submit" disabled={updateSettings.isPending || !retentionConfirmed} data-testid="button-save-retention">{updateSettings.isPending ? 'Saving setting…' : 'Confirm & save'} <Check size={15} /></button></div>
        </form><aside className="retention-side"><div className="launch-checklist"><span className="eyebrow">LAUNCH CHECKLIST</span><h2>Before choosing a retention period</h2><div><CheckCircle2 /><p><b>Confirm local privacy rules.</b><br />Check the applicable privacy requirements and retention obligations before enabling automatic deletion.</p></div><p>CRITS should select a period that matches its approved privacy policy and operational needs.</p></div><div className="admin-note"><ShieldCheck /><p><b>Current setting</b><br />{adminSettings.data.enquiryRetentionDays == null ? 'Automatic deletion is off because no retention period is set.' : `${adminSettings.data.enquiryRetentionDays} days`}</p></div></aside></div>}
      </>}
    </div></section>
  </main>;
}
function CategoryForm({ pending, initial, onCancel, onSubmit }: { pending: boolean; initial?: Category; onCancel: () => void; onSubmit: (data: { name: string; slug: string; description: string; active: boolean }) => void }) {
  const [name, setName] = useState(initial?.name ?? '');
  const [slug, setSlug] = useState(initial?.slug ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [active, setActive] = useState(initial?.active ?? true);
  return <form className="category-create-form" onSubmit={(e) => { e.preventDefault(); onSubmit({ name: name.trim(), slug: slug.trim() || slugify(name), description: description.trim(), active }); }}>
    <label>Category name<input required maxLength={120} value={name} onChange={(e) => { setName(e.target.value); if (!initial) setSlug(slugify(e.target.value)); }} data-testid="input-category-name" /></label>
    <label>Category slug<input required maxLength={140} value={slug} onChange={(e) => setSlug(slugify(e.target.value))} data-testid="input-category-slug" /></label>
    <label>Description<input maxLength={500} value={description} onChange={(e) => setDescription(e.target.value)} /></label>
    <label className="check-field"><input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} /> Active in public catalogue</label>
    <button className="button button-primary" disabled={pending || !name.trim() || !slug.trim()}>{pending ? 'Saving…' : initial ? 'Save changes' : 'Create category'}</button>
    <button type="button" className="text-button" onClick={onCancel}>Cancel</button>
  </form>;
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
  return <article className="enquiry-card" data-testid={`card-admin-enquiry-${enquiry.id}`}><div className="enquiry-card-head"><div><span className="eyebrow">{enquiry.reference} · {new Date(enquiry.createdAt).toLocaleString()}</span><h2>{enquiry.name}</h2><p>{enquiry.organisation || 'Individual enquiry'} · prefers {human(enquiry.preferredContactMethod)}</p></div><StatusPill value={enquiry.status} /></div><div className="enquiry-contact-links">{enquiry.preferredContactMethod === 'email' ? <a href={`mailto:${enquiry.contactValue}`}><Mail size={14} />{enquiry.contactValue}</a> : <a href={`tel:${enquiry.contactValue}`}><Phone size={14} />{enquiry.contactValue}</a>}{enquiry.preferredContactMethod === 'whatsapp' && whatsappLinkFor(enquiry.contactValue) && <a href={whatsappLinkFor(enquiry.contactValue)} target="_blank" rel="noreferrer"><MessageCircle size={14} />WhatsApp customer</a>}</div>{enquiry.message && <p className="enquiry-message">{enquiry.message}</p>}{enquiry.locationNotes && <p className="enquiry-meta-text">Location notes: {enquiry.locationNotes}</p>}{enquiry.items.length > 0 && <div className="enquiry-items"><b>Requested products</b>{enquiry.items.map((item) => <span key={item.productId}>{item.title} × {item.quantity}</span>)}</div>}<div className="enquiry-admin-actions"><label>Internal note<textarea value={note} maxLength={2000} rows={2} onChange={(e) => setNote(e.target.value)} placeholder="For CRITS staff only" data-testid={`input-enquiry-note-${enquiry.id}`} /></label><div><button className="small-action" disabled={pending} onClick={() => onUpdate({ internalNote: note || null })} data-testid={`button-save-note-${enquiry.id}`}>Save note</button><label className="status-select-label">Status<select value={enquiry.status} onChange={(e) => onUpdate({ status: e.target.value as AdminEnquiry['status'] })} data-testid={`select-enquiry-status-${enquiry.id}`}><option value="new">New</option><option value="in_progress">In progress</option><option value="replied">Replied</option><option value="closed">Closed</option></select></label></div></div></article>;
}
function Router() {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}><Switch>
    <Route path="/" component={Home} /><Route path="/technology" component={TechnologyHome} /><Route path="/real-estate" component={RealEstatePage} />
    <Route path="/catalog" component={Catalog} /><Route path="/products/:slug" component={ProductDetail} />
    <Route path="/basket" component={Basket} /><Route path="/contact" component={Contact} /><Route path="/about" component={About} /><Route path="/services" component={Services} /><Route path="/privacy" component={Privacy} />
    <Route path="/sign-in/*?" component={clerkPubKey ? SignInPage : StaffAuthConfiguration} /><Route path="/sign-up/*?" component={clerkPubKey ? SignUpPage : StaffAuthConfiguration} /><Route path="/admin" component={Admin} /><Route component={NotFound} />
  </Switch></ErrorBoundary>;
}

function ClerkProviderWithRoutes() {
  const [, setLocation] = useLocation();
  if (!clerkPubKey) return <Router />;
  const stripBase = (path: string) => basePath && path.startsWith(basePath)
    ? path.slice(basePath.length) || '/'
    : path;
  return <ClerkProvider
    publishableKey={clerkPubKey}
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
