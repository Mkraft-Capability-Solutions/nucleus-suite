import type { Metadata } from "next";
import { ModuleView, modules } from "@/components/hrms/module-view";

export function generateStaticParams() {
  return modules.map((module) => ({ module }));
}

export async function generateMetadata({ params }: { params: Promise<{ module: string }> }): Promise<Metadata> {
  const { module } = await params;
  const label = module.replaceAll("-", " ");
  return { title: label.charAt(0).toUpperCase() + label.slice(1) };
}

export default async function ModulePage({ params, searchParams }: { params: Promise<{ module: string }>; searchParams: Promise<{ section?: string; record?: string }> }) {
  const { module } = await params;
  const { section, record } = await searchParams;
  return <ModuleView module={module} section={section} record={record} />;
}
