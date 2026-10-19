"use client";

/**
 * Minimal react-router-dom compatible API on top of the Next.js App Router.
 * Lets ported marketing-site components keep their imports while the app runs on Next.js.
 * Scope: Link, Navigate, useLocation, useNavigate, useParams, useSearchParams (the subset the ported code uses).
 */
import NextLink from "next/link";
import { useParams as useNextParams, usePathname, useRouter, useSearchParams as useNextSearchParams } from "next/navigation";
import { forwardRef, useCallback, useEffect, useMemo, useState, type AnchorHTMLAttributes, type ReactNode } from "react";

type To = string | { pathname?: string; search?: string; hash?: string };

interface NavigateOptions {
  replace?: boolean;
  state?: unknown;
}

export interface Location {
  pathname: string;
  search: string;
  hash: string;
  state: unknown;
  key: string;
}

function toHref(to: To): string {
  if (typeof to === "string") return to;
  return `${to.pathname ?? ""}${to.search ?? ""}${to.hash ?? ""}`;
}

function useHash(): string {
  const [hash, setHash] = useState("");
  useEffect(() => {
    const update = (): void => setHash(window.location.hash);
    update();
    window.addEventListener("hashchange", update);
    return () => window.removeEventListener("hashchange", update);
  }, []);
  return hash;
}

export function useLocation(): Location {
  const pathname = usePathname() ?? "/";
  const params = useNextSearchParams();
  const hash = useHash();
  const search = params && params.toString() ? `?${params.toString()}` : "";
  return useMemo(() => ({ pathname, search, hash, state: null, key: `${pathname}${search}${hash}` }), [pathname, search, hash]);
}

export function useNavigate(): (to: To | number, options?: NavigateOptions) => void {
  const router = useRouter();
  return useCallback(
    (to: To | number, options?: NavigateOptions) => {
      if (typeof to === "number") {
        if (to < 0) router.back();
        else router.forward();
        return;
      }
      const href = toHref(to);
      if (options?.replace) router.replace(href);
      else router.push(href);
    },
    [router],
  );
}

export function useParams<T extends Record<string, string>>(): Partial<T> {
  return (useNextParams() ?? {}) as Partial<T>;
}

export function useSearchParams(): [URLSearchParams, (next: URLSearchParams | Record<string, string>) => void] {
  const params = useNextSearchParams();
  const router = useRouter();
  const pathname = usePathname() ?? "/";
  const current = useMemo(() => new URLSearchParams(params?.toString() ?? ""), [params]);
  const set = useCallback(
    (next: URLSearchParams | Record<string, string>) => {
      const value = next instanceof URLSearchParams ? next : new URLSearchParams(next);
      const query = value.toString();
      router.replace(query ? `${pathname}?${query}` : pathname);
    },
    [router, pathname],
  );
  return [current, set];
}

export function Navigate({ to, replace = false }: { to: To; replace?: boolean; state?: unknown }): null {
  const navigate = useNavigate();
  useEffect(() => {
    navigate(to, { replace });
  }, [navigate, to, replace]);
  return null;
}

type LinkProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> & {
  to: To;
  replace?: boolean;
  state?: unknown;
  children?: ReactNode;
};

export const Link = forwardRef<HTMLAnchorElement, LinkProps>(function Link({ to, replace, state: _state, ...rest }, ref) {
  return <NextLink ref={ref} href={toHref(to)} replace={replace} {...rest} />;
});
