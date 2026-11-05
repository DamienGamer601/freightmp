import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Politique de confidentialité — FreightMP",
  description:
    "Politique de confidentialité de FreightMP : données collectées, finalités, cookies, durées de conservation et droits RGPD.",
};

export default function PrivacyPage() {
  return (
    <article className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8">
      <p className="section-eyebrow">Légal</p>
      <h1 className="section-title mt-3">Politique de confidentialité</h1>
      <p className="mt-3 text-sm text-zinc-500">
        Dernière mise à jour : 5 novembre 2026
      </p>

      <div className="mt-10 space-y-4">
        <Section title="1. Responsable du traitement">
          <p>
            Le responsable du traitement des données est{" "}
            <strong>FR | Industries Corporation</strong>, éditeur de FreightMP.
          </p>
          <p>
            FreightMP est un projet communautaire indépendant, non affilié à SCS
            Software, Steam ou Discord.
          </p>
        </Section>

        <Section title="2. Données collectées">
          <p>Nous collectons uniquement les données nécessaires au Service :</p>
          <ul className="list-disc space-y-2 pl-5">
            <li>
              <strong>Identifiants de connexion</strong> : SteamID64 et/ou
              identifiant Discord, nom d’utilisateur, avatar et pays (fournis par
              Steam/Discord lors de la connexion).
            </li>
            <li>
              <strong>Profil</strong> : pseudo, bio, titre, bannière, couleur
              d’accent, préférences.
            </li>
            <li>
              <strong>Données de jeu</strong> : télémétrie (position, vitesse,
              véhicule, cargaison), livraisons, kilomètres parcourus, temps de jeu.
            </li>
            <li>
              <strong>Vie communautaire</strong> : appartenance à une compagnie
              virtuelle (VTC), événements, amis, messages, notifications.
            </li>
            <li>
              <strong>Données techniques</strong> : adresse IP, horodatage des
              requêtes et journaux d’erreurs, utilisés pour la sécurité et la
              limitation de débit.
            </li>
          </ul>
        </Section>

        <Section title="3. Finalités et bases légales">
          <ul className="list-disc space-y-2 pl-5">
            <li>
              <strong>Fournir le Service</strong> (compte, multijoueur, VTC,
              messagerie) : exécution du contrat.
            </li>
            <li>
              <strong>Sécurité et modération</strong> (anti-triche, bannissements,
              journaux) : intérêt légitime.
            </li>
            <li>
              <strong>Notifications</strong> par e-mail ou Discord : consentement,
              révocable à tout moment.
            </li>
          </ul>
        </Section>

        <Section title="4. Durée de conservation">
          <p>
            Les données de compte sont conservées tant que le compte existe. En cas
            de suppression, elles sont effacées dans un délai maximal de 30 jours,
            sauf obligation légale de conservation (par exemple les journaux de
            sécurité).
          </p>
          <p>
            Les journaux techniques sont conservés pour une durée limitée, le temps
            nécessaire à la sécurité du Service.
          </p>
        </Section>

        <Section title="5. Cookies et stockage local">
          <p>
            FreightMP utilise uniquement des cookies <strong>strictement
            nécessaires</strong> à l’authentification :
          </p>
          <ul className="list-disc space-y-2 pl-5">
            <li>
              <code className="rounded bg-white/5 px-1.5 py-0.5 text-xs">fmp_access</code>{" "}
              — jeton d’accès de courte durée (HttpOnly).
            </li>
            <li>
              <code className="rounded bg-white/5 px-1.5 py-0.5 text-xs">fmp_refresh</code>{" "}
              — jeton de rafraîchissement (HttpOnly).
            </li>
          </ul>
          <p>
            Aucun cookie publicitaire ni traceur tiers n’est utilisé. Le site peut
            conserver vos préférences d’affichage (thème, langue) dans le stockage
            local de votre navigateur.
          </p>
        </Section>

        <Section title="6. Destinataires et partage">
          <p>
            Vos données ne sont ni vendues ni louées. Elles peuvent être traitées
            par :
          </p>
          <ul className="list-disc space-y-2 pl-5">
            <li>
              notre hébergeur, pour le stockage et l’exécution du Service ;
            </li>
            <li>
              les API Steam et Discord, uniquement pour vérifier votre identité et
              récupérer votre profil public ;
            </li>
            <li>
              les autorités compétentes, sur réquisition légale.
            </li>
          </ul>
        </Section>

        <Section title="7. Sécurité">
          <p>
            Les échanges sont chiffrés (HTTPS en production). Les jetons
            d’authentification sont stockés dans des cookies HttpOnly et les jetons
            de rafraîchissement sont hachés en base. L’accès aux données est limité
            aux personnes habilitées.
          </p>
          <p>
            Aucun système n’étant infaillible, nous vous invitons à nous signaler
            toute vulnérabilité via notre serveur Discord.
          </p>
        </Section>

        <Section title="8. Vos droits">
          <p>
            Conformément au Règlement Général sur la Protection des Données (RGPD),
            vous disposez des droits suivants :
          </p>
          <ul className="list-disc space-y-2 pl-5">
            <li>droit d’accès à vos données ;</li>
            <li>droit de rectification ;</li>
            <li>droit à l’effacement (« droit à l’oubli ») ;</li>
            <li>droit à la portabilité ;</li>
            <li>droit d’opposition et de limitation du traitement ;</li>
            <li>
              droit d’introduire une réclamation auprès de la CNIL
              (www.cnil.fr).
            </li>
          </ul>
          <p>
            Ces droits s’exercent via votre espace personnel ou en contactant
            l’équipe sur le serveur Discord officiel.
          </p>
        </Section>

        <Section title="9. Mineurs">
          <p>
            Le Service suit les conditions d’utilisation de Discord : l’accès est
            réservé aux personnes âgées de 13 ans ou plus. Si vous êtes mineur,
            l’accord d’un représentant légal est recommandé.
          </p>
        </Section>

        <Section title="10. Modification de la politique">
          <p>
            Cette politique peut être mise à jour. La date de dernière mise à jour
            figure en tête de page. Les changements significatifs seront signalés
            dans le Service.
          </p>
        </Section>

        <Section title="11. Contact">
          <p>
            Pour toute question relative à vos données personnelles, contactez
            l’équipe via le serveur Discord officiel de FreightMP. Vous pouvez
            également consulter nos{" "}
            <a href="/terms-of-service" className="text-rouge-400 hover:underline">
              Conditions Générales d’Utilisation
            </a>
            .
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
