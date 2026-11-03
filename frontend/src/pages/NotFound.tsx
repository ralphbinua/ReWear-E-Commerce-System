import { Link } from "react-router-dom";

export default function NotFound() {
  return (
    <div className="shell py-24 text-center">
      <p className="font-display text-7xl font-semibold text-leaf-600">404</p>
      <h1 className="mt-4 text-2xl font-semibold text-charcoal">
        This page doesn't exist.
      </h1>
      <p className="mt-2 text-charcoal/70">Try browsing instead of hunting this URL.</p>
      <Link
        to="/browse"
        className="mt-6 inline-block rounded-full bg-leaf-600 px-6 py-2.5 font-semibold text-cream hover:bg-leaf-700"
      >
        Browse pre-loved finds
      </Link>
    </div>
  );
}
