'use strict';
/* Read-only snapshot of the n8n published graph inspected 2026-11-18 JST.
 * This is not an authenticated n8n API binding. Every future live call MUST
 * re-attest the exact published workflow versions from a trusted server port.
 */
module.exports={
  core:{
    id:'iyfGUiEsZlNTBWOR',
    draft:'c96422e0-170b-46a3-8d75-3a2695e645e7',
    published:'456862c9-e5ee-4bfa-9931-47dbc39ab73d',
    fullAgentReadOnlyVerified:false,
    hasTicketInsertTool:true,
    writeTool:{
      name:'Create Sandbox Ticket',workflowId:'jirkuVts1AjIhnPJ',
      published:'d7d1d80d-38f3-49cd-8290-6930072cc231',
      mutationNode:'Store Commerce Support Ticket',
      mutationOperation:'DataTable row.insert'
    }
  },
  resolver:{id:'5Eeh8hbpsoNhuiVo',
    published:'a99c7350-7aea-446d-bdc5-4b10f52c3ad1'},
  catalog:{id:'oOOXicKXGkBskKqh',
    published:'e0f1e345-8e6c-40cb-8e6a-d7ad2eb92696',
    storageOperation:'DataTable row.get'},
  cart:{id:'igPOsSbEgd4NgtRA',
    published:'eff32e20-a6d0-4975-88b8-107eae752b4b',
    storageOperation:'DataTable row.get'},
  allowedChildren:['CATALOG_QUERY','CART_PREVIEW'],
  liveN8nCoreCalledForV1852:false,
  noProduction:true
};
