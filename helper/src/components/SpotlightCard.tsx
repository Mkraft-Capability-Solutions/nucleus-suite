import React from "react";
import { cn } from "@/lib/utils";

interface SpotlightCardProps extends React.PropsWithChildren {
  className?: string;
  spotlightColor?: string;
}

const SpotlightCard: React.FC<SpotlightCardProps> = ({
  children,
  className = "",
}) => {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-lg border border-border bg-card p-5 text-card-foreground shadow-[var(--shadow-surface)] transition-colors duration-150 hover:border-primary/35",
        className
      )}
    >
      {children}
    </div>
  );
};

export default SpotlightCard;
