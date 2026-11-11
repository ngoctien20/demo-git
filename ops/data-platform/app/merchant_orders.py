"""Merchant HTTP routes for a gateway provisioned with a trusted Commerce connection."""
from typing import Annotated
from uuid import UUID

from fastapi import Depends, Header, HTTPException
from pydantic import BaseModel, ConfigDict, Field, StrictInt

from .commerce_transactions import CommerceRejected, cancel, checkout, update_order


class Cart(BaseModel):
    model_config = ConfigDict(extra="forbid")
    items: dict[str, StrictInt] = Field(min_length=1, max_length=100)


class QuantityChange(BaseModel):
    model_config = ConfigDict(extra="forbid")
    sku: str = Field(min_length=1, max_length=80)
    quantity: StrictInt = Field(ge=1, le=10000)


IdempotencyKey = Annotated[str, Header(alias="Idempotency-Key", min_length=8, max_length=128)]


def add_merchant_orders(app, identity, connect):
    root = "/api/v1/tenants/{tenant_id}/orders"

    def execute(action, tenant, auth, *args, **kwargs):
        _, actor = auth
        try:
            with connect() as connection:
                order = action(connection, tenant, actor, *args, **kwargs)
        except CommerceRejected as error:
            reason = str(error)
            status = {"access_denied":403, "unknown_order":404, "unknown_line":404,
                      "invalid_request":422, "invalid_sku":422, "invalid_quantity":422}.get(reason, 409)
            raise HTTPException(status_code=status, detail=reason) from error
        return {"order_id": order if order is not None else args[0]}

    @app.post(root)
    def create(tenant_id: UUID, cart: Cart, key: IdempotencyKey, auth=Depends(identity)):
        return execute(checkout, tenant_id, auth, key, cart.items)

    @app.put(root + "/{order_id}/quantity")
    def change_quantity(tenant_id: UUID, order_id: UUID, change: QuantityChange, key: IdempotencyKey, auth=Depends(identity)):
        return execute(update_order, tenant_id, auth, order_id, key, sku=change.sku, quantity=change.quantity)

    @app.post(root + "/{order_id}/confirm")
    def confirm(tenant_id: UUID, order_id: UUID, key: IdempotencyKey, auth=Depends(identity)):
        return execute(update_order, tenant_id, auth, order_id, key, confirm=True)

    @app.post(root + "/{order_id}/cancel")
    def cancel_order(tenant_id: UUID, order_id: UUID, auth=Depends(identity)):
        return execute(cancel, tenant_id, auth, order_id)
