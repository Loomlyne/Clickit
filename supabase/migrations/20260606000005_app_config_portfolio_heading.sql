-- Admin-editable heading for the shows/portfolio section on the landing page.
-- Falls back to the i18n translation key landing.portfolioHeading when null.
alter table public.app_config
  add column if not exists portfolio_heading text;

alter table public.app_config
  add column if not exists portfolio_heading_ar text;

comment on column public.app_config.portfolio_heading is
  'English heading above the shows grid on the landing page. Overrides the i18n fallback when set.';

comment on column public.app_config.portfolio_heading_ar is
  'Arabic heading above the shows grid on the landing page. Shown when locale is ar; overrides the i18n Arabic fallback when set.';
