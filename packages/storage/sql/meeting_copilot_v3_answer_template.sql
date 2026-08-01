-- Run after meeting_copilot.sql
-- Adds answer-template doc type (always injected into cue prompts, not RAG-only)

alter table public.meeting_knowledge_docs
  drop constraint if exists meeting_knowledge_docs_doc_type_check;

alter table public.meeting_knowledge_docs
  add constraint meeting_knowledge_docs_doc_type_check
  check (doc_type in (
    'pitch', 'metrics', 'faq', 'strategy', 'product', 'competitor', 'note', 'answer-template'
  ));
