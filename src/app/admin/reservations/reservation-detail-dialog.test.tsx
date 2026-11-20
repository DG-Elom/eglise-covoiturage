import { describe, expect, it, vi, beforeAll } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ReservationDetailDialog, libelleMotifRefus } from "./reservation-detail-dialog";
import type { Reservation } from "./reservations-table";

beforeAll(() => {
  // jsdom n'implémente pas showModal/close.
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute("open");
    this.dispatchEvent(new Event("close"));
  };
});

const resa: Reservation = {
  id: "r1",
  sens: "aller",
  statut: "refused",
  pickup_adresse: "Val de Briey, Meurthe-et-Moselle, France",
  demande_le: "2026-11-19T17:40:00Z",
  traitee_le: "2026-11-19T17:49:16Z",
  cancelled_le: null,
  motif_refus: "trajet_complet_auto",
  passager: { id: "p1", prenom: "Gracia", nom: "Dossouvi", photo_url: null },
  trajets_instances: {
    id: "i1",
    date: "2026-11-22",
    trajets: {
      id: "t1",
      depart_adresse: "12 rue du Départ, 57000 Metz",
      heure_depart: "09:15:00",
      conducteur: { id: "c1", prenom: "Marlyse", nom: "Dehoumon", photo_url: null },
      cultes: { libelle: "Culte du dimanche", heure: "10:00:00" },
    },
  },
};

describe("ReservationDetailDialog", () => {
  it("affiche toutes les infos en entier", () => {
    render(
      <ReservationDetailDialog reservation={resa} onClose={() => {}} actions={null} />,
    );
    expect(screen.getByText("Val de Briey, Meurthe-et-Moselle, France")).toBeTruthy();
    expect(screen.getByText("12 rue du Départ, 57000 Metz")).toBeTruthy();
    expect(screen.getByText(/Culte du dimanche/)).toBeTruthy();
    expect(screen.getByText(/09:15/)).toBeTruthy();
    expect(screen.getByText("Trajet complet (refus automatique)")).toBeTruthy();
    expect(screen.getByRole("link", { name: /Gracia Dossouvi/ }).getAttribute("href")).toBe("/u/p1");
    expect(screen.getByRole("link", { name: /Marlyse Dehoumon/ }).getAttribute("href")).toBe("/u/c1");
  });

  it("se ferme avec le bouton Fermer", async () => {
    const onClose = vi.fn();
    render(<ReservationDetailDialog reservation={resa} onClose={onClose} actions={null} />);
    await userEvent.click(screen.getByRole("button", { name: "Fermer" }));
    expect(onClose).toHaveBeenCalled();
  });

  it("traduit les motifs de refus connus et garde les autres tels quels", () => {
    expect(libelleMotifRefus("conducteur_refus")).toBe("Refusée par le conducteur");
    expect(libelleMotifRefus("autre_chose")).toBe("autre_chose");
    expect(libelleMotifRefus(null)).toBeNull();
  });
});
