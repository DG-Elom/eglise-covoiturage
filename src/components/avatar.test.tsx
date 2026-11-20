import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { Avatar } from "./avatar";

describe("Avatar", () => {
  it("mène au profil de la personne quand userId est fourni", () => {
    render(<Avatar userId="abc-123" prenom="Gracia" nom="Dossouvi" photoUrl={null} />);
    const lien = screen.getByRole("link", { name: /Gracia Dossouvi|GD/ });
    expect(lien.getAttribute("href")).toBe("/u/abc-123");
    expect(lien.getAttribute("title")).toBe("Voir le profil de Gracia Dossouvi");
  });

  it("n'est pas cliquable sans userId", () => {
    render(<Avatar prenom="Gracia" nom="Dossouvi" photoUrl={null} />);
    expect(screen.queryByRole("link")).toBeNull();
    expect(screen.getByText("GD")).toBeTruthy();
  });

  it("garde la photo à l'intérieur du lien", () => {
    render(<Avatar userId="abc-123" prenom="Gracia" nom="Dossouvi" photoUrl="https://x/p.jpg" />);
    const img = screen.getByRole("img");
    expect(img.closest("a")?.getAttribute("href")).toBe("/u/abc-123");
  });
});
