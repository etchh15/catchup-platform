-- Force PostgREST to refresh its schema cache after the review contract fix.
NOTIFY pgrst, 'reload schema';
