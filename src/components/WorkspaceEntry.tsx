"use client";
import dynamic from 'next/dynamic';
import WorkspaceDataBoundary from '@/components/WorkspaceDataBoundary';
const Workspace = dynamic(() => import('@/components/WorkspaceShell'), { ssr: false });
export default function WorkspaceEntry() {
    return <WorkspaceDataBoundary><Workspace /></WorkspaceDataBoundary>;
}
