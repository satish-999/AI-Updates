import Link from "next/link";
import { Nav } from "./nav";
export function Shell({ children }: { children: React.ReactNode }) {
  return <div className="product-shell"><header className="product-header"><Link href="/" className="product-brand"><span className="brand-mark" aria-hidden="true">p.</span><span>AI Pulse<small>Know what’s next. Choose what works.</small></span></Link><span className="pilot-label">Early access</span></header><Nav /><main className="product-main">{children}</main><footer className="product-footer"><span>Evidence first. Useful by design.</span><span><Link href="/privacy">Privacy</Link> · <Link href="/terms">Terms</Link> · <Link href="/pricing">Plans</Link></span></footer></div>;
}
