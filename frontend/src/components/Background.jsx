import React, { useEffect, useState } from "react";
import ClosingPlasma from "./ClosingPlasma";

// Fixed backdrop with two options:
//  - "aurora": a drifting aurora image with twinkling stars (pure CSS, see theme.css)
//  - "plasma": the WebGL ClosingPlasma shader, mounted only while it is in use
export default function Background({ variant = "aurora" }) {
  const plasmaWanted = variant === "plasma";
  const [plasmaMounted, setPlasmaMounted] = useState(plasmaWanted);

  // Keep the shader alive just long enough to fade out, then free the GPU.
  useEffect(() => {
    if (plasmaWanted) {
      setPlasmaMounted(true);
      return undefined;
    }
    const id = setTimeout(() => setPlasmaMounted(false), 900);
    return () => clearTimeout(id);
  }, [plasmaWanted]);

  return (
    <div className="bg" aria-hidden="true">
      <div className="bg-group">
        <i className="bg-aurora" />
        <i className="bg-stars a" />
        <i className="bg-stars b" />
      </div>
      {plasmaMounted && (
        <div className={`bg-plasma${plasmaWanted ? "" : " out"}`}>
          <ClosingPlasma
            speed={0.5}
            turbulence={0.7}
            mouseInfluence={0}
            grain={0.75}
            sparkle={0.45}
            vignette={1}
            opacity={1}
            interactive={false}
            maxPixelRatio={1}
            darkColorA="#111214"
            darkColorB="#2a2d33"
            darkColorC="#6b7280"
            lightColorA="#f0f2f7"
            lightColorB="#d7dceb"
            lightColorC="#bcc5e0"
          />
        </div>
      )}
    </div>
  );
}
