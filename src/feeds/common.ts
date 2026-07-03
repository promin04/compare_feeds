/**
 * Shared primitives used by more than one feed.
 * Both the Betradar and SportbookV2 feeds carry the same localised text shapes.
 */

/** Localised text keyed by language code (English / Thai / Chinese / Taiwan). */
export interface Localized {
  en: string;
  th: string;
  cn: string;
  tw: string;
}

/** Home/away pair (e.g. team names, scores). */
export interface HomeAway {
  /** Home side. */
  h: string;
  /** Away side. */
  a: string;
}

/** Localised home/away names, keyed by language code. */
export interface LocalizedHomeAway {
  en: HomeAway;
  th: HomeAway;
  cn: HomeAway;
  tw: HomeAway;
}
