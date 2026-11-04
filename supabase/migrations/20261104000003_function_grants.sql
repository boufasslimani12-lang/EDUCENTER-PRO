-- EDUCENTER PRO — tighten function EXECUTE grants
-- Permissions only: no tables, data, or function bodies are changed.

-- 1. Undo the side effect of the blanket grant in migration 2 on the pre-existing,
--    Supabase-managed event-trigger function.
revoke execute on function public.rls_auto_enable() from authenticated;

-- 2. Replace the blanket "grant execute on all functions in schema public" with an
--    explicit allow-list of the app's own functions.
revoke execute on all functions in schema public from authenticated;

grant execute on function public.tenant_effective_status(public.tenants) to authenticated;
grant execute on function public.provision_tenant(text, text, public.institution_type, text, integer, text) to authenticated;
grant execute on function public.claim_invitations() to authenticated;
grant execute on function public.invite_teacher(uuid) to authenticated;
grant execute on function public.generate_installments(uuid, date) to authenticated;
grant execute on function public.reenroll_student(uuid, uuid, uuid, numeric, numeric, uuid[]) to authenticated;
grant execute on function public.calculate_remuneration(uuid, date) to authenticated;
grant execute on function public.my_remuneration(uuid) to authenticated;
grant execute on function public.review_subscription_payment(uuid, boolean, text) to authenticated;
grant execute on function public.platform_stats() to authenticated;
