-- 0017 : lien de la vidéo « Comment s'inscrire » (YouTube ou fichier MP4), réglable par le super admin
alter table public.platform_settings
  add column site_signup_video_url text check (site_signup_video_url is null or (length(site_signup_video_url) <= 300 and site_signup_video_url ~ '^https://'));
