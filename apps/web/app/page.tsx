"use client";
import dynamic from "next/dynamic";
const App = dynamic(() => import("../src/App"), { ssr: false, loading: () => <div className="boot" role="status">Pointing the telescope…</div> });
export default function Page() { return <App />; }
