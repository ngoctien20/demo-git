-- Apply atomically. Configuration metadata only. Creating a row never activates a workflow.
CREATE TABLE public.tenant_agent_configs (
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  channel text NOT NULL CHECK (channel = 'pilot_lab'),
  bot_id text NOT NULL CHECK (bot_id = 'NvQfIffOrZokPBPW'),
  workflow_version uuid NOT NULL,
  prompt_version text NOT NULL CHECK (length(trim(prompt_version)) BETWEEN 1 AND 80),
  knowledge_version text NOT NULL CHECK (length(trim(knowledge_version)) BETWEEN 1 AND 80),
  model text NOT NULL CHECK (model = 'gpt-5-mini'),
  lifecycle text NOT NULL DEFAULT 'paused' CHECK (lifecycle IN ('preview','paused')),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, channel)
);
ALTER TABLE public.tenant_agent_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_agent_configs FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.tenant_agent_configs FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.tenant_agent_configs TO authenticated;
CREATE POLICY agent_config_merchant_read ON public.tenant_agent_configs FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.tenant_memberships m
  WHERE m.tenant_id=tenant_agent_configs.tenant_id AND m.user_id=(SELECT auth.uid())
    AND m.active AND m.role IN ('owner','manager')
));
