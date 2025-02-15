"use client";

import Image from "next/image";
import { useState } from "react";

interface ItemImageProps {
  sku: string;
}

export function ItemImages({ sku }: ItemImageProps) {
  const [isHovered, setIsHovered] = useState(false);

  // Split SKU into parts (e.g. DAYDREAMER_BLACK_S -> ["DAYDREAMER", "BLACK", "S"])
  const [series, color] = sku.toLowerCase().split("_");

  return (
    <div className="relative w-40 border aspect-square rounded-full">
      <div
        className="absolute inset-2 overflow-hidden rounded-full"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <Image
          src={`/items/${series}/${color}_back.png`}
          alt={`${series} ${color} back`}
          fill
          className={`object-cover transition-opacity duration-300 ${
            isHovered ? "opacity-0" : "opacity-100"
          }`}
        />
        <Image
          src={`/items/${series}/${color}_front.png`}
          alt={`${series} ${color} front`}
          fill
          className={`object-cover transition-opacity duration-300 ${
            isHovered ? "opacity-100" : "opacity-0"
          }`}
        />
      </div>
    </div>
  );
}
