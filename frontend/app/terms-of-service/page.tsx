import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Conditions Générales d’Utilisation — FreightMP",
  description:
    "Conditions Générales d’Utilisation de FreightMP, la plateforme multijoueur pour Euro Truck Simulator 2 et American Truck Simulator.",
};

export default function TermsPage() {
  return (
    <article className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8">
      <p className="section-eyebrow">Légal</p>
      <h1 className="section-title mt-3">Conditions Générales d’Utilisation</h1>
      <p className="mt-3 text-sm text-zinc-500">
        Dernière mise à jour : 5 novembre 2026
      </p>

      <div className="mt-10 space-y-4">
        <Section title="1. Objet">
          <p>
            Les présentes Conditions Générales d’Utilisation (« CGU ») encadrent
            l’accès et l’utilisation de FreightMP (« le Service »), plateforme
            communautaire et hub multijoueur destiné aux simulateurs de camion
            Euro Truck Simulator 2 et American Truck Simulator.
          </p>
          <p>
            En créant un compte ou en utilisant le Service, vous acceptez sans
            réserve les présentes CGU.
          </p>
        </Section>

        <Section title="2. Éditeur">
          <p>
            Le Service est édité par <strong>FR | Industries Corporation</strong>{" "}
            dans le cadre d’un projet communautaire indépendant.
          </p>
          <p>
            FreightMP n’est ni affilié à, ni approuvé, ni sponsorisé par SCS
            Software. Euro Truck Simulator 2 et American Truck Simulator sont des
            marques de SCS Software.
          </p>
        </Section>

        <Section title="3. Accès au Service">
          <p>
            L’accès nécessite un compte créé via Steam ou Discord. Le Service est
            gratuit et ne vend aucune donnée personnelle.
          </p>
          <p>
            Vous êtes responsable de la confidentialité de vos identifiants et de
            toute activité effectuée depuis votre compte.
          </p>
        </Section>

        <Section title="4. Règles de conduite">
          <p>En utilisant le Service, vous vous engagez à :</p>
          <ul className="list-disc space-y-2 pl-5">
            <li>respecter les autres joueurs et les membres de l’équipe ;</li>
            <li>
              ne pas tricher, modifier le client, exploiter des failles ou
              perturber le serveur ;
            </li>
            <li>
              ne pas publier de contenu illégal, haineux, harcelant ou
              trompeur ;
            </li>
            <li>ne pas usurper l’identité d’un autre joueur ou d’un membre du staff ;</li>
            <li>respecter les conditions d’utilisation de Steam et de Discord.</li>
          </ul>
        </Section>

        <Section title="5. Sanctions et modération">
          <p>
            L’équipe de modération peut prononcer un avertissement, une suspension
            temporaire ou un bannissement définitif en cas de violation des
            présentes CGU.
          </p>
          <p>
            Chaque sanction est motivée et peut faire l’objet d’un appel selon la
            procédure indiquée dans votre espace personnel.
          </p>
        </Section>

        <Section title="6. Propriété intellectuelle">
          <p>
            Le nom, le logo et les éléments graphiques propres à FreightMP sont la
            propriété de FR | Industries Corporation. Les marques, modèles et
            contenus du jeu appartiennent à leurs détenteurs respectifs (SCS
            Software et ses partenaires).
          </p>
          <p>
            Vous conservez la propriété du contenu que vous publiez (bio, avatar,
            messages) et accordez au Service une licence limitée pour l’afficher
            dans le cadre de son fonctionnement.
          </p>
        </Section>

        <Section title="7. Disponibilité et responsabilité">
          <p>
            Le Service est fourni « en l’état », sans garantie de disponibilité,
            d’exactitude ou d’absence d’erreur. Des interruptions peuvent survenir
            pour maintenance ou mise à jour.
          </p>
          <p>
            Dans les limites permises par la loi, FR | Industries Corporation ne
            peut être tenue responsable des dommages indirects résultant de
            l’utilisation ou de l’impossibilité d’utiliser le Service.
          </p>
        </Section>

        <Section title="8. Données personnelles">
          <p>
            Le traitement de vos données est décrit dans notre politique de
            confidentialité, accessible à l’adresse{" "}
            <a href="/privacy-policy" className="text-rouge-400 hover:underline">
              /privacy-policy
            </a>
            .
          </p>
        </Section>

        <Section title="9. Modification des CGU">
          <p>
            Ces CGU peuvent évoluer. La date de dernière mise à jour figure en
            tête de page. En cas de modification substantielle, les utilisateurs
            en seront informés via le Service.
          </p>
        </Section>

        <Section title="10. Droit applicable">
          <p>
            Les présentes CGU sont soumises au droit français. Tout litige relève
            des juridictions compétentes, sous réserve des dispositions légales
            impératives applicables aux consommateurs.
          </p>
        </Section>

        <Section title="11. Contact">
          <p>
            Pour toute question relative aux présentes CGU, contactez l’équipe via
            le serveur Discord officiel de FreightMP.
          </p>
        </Section>
      </div>
    </article>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="card p-6">
      <h2 className="text-lg font-semibold text-white">{title}</h2>
      <div className="mt-3 space-y-3 text-sm leading-relaxed text-zinc-400">
        {children}
      </div>
    </section>
  );
}
