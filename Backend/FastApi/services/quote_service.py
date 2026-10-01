"""Cotizaciones versionadas; las escrituras RPC son transacciones en PostgreSQL."""
from datetime import date
from fastapi import HTTPException
from FastApi.db.access import all_rows, call, one
from FastApi.services.vehicle_service import require_role
from FastApi.services.work_order_service import authorized_order


def list_quotes(client, user, order_id):
    authorized_order(client, user, order_id)
    params = {"work_order_id": f"eq.{order_id}", "order": "version.desc"}
    if user.role == "CLIENT":
        params["status"] = "not.in.(DRAFT,SUPERSEDED)"
    return all_rows(client, "quotes", **params)


def action(client, user, order_id, operation, quote_id=None, data=None):
    authorized_order(client, user, order_id)
    require_role(user, "CLIENT" if operation in ("ACCEPT", "REJECT") else "ADMIN")
    if data and data.valid_until < date.today():
        raise HTTPException(422, "La vigencia no puede estar en el pasado.")
    return call(client, "POST", "/rest/v1/rpc/quote_action", json={
        "p_actor": str(user.id), "p_order": str(order_id), "p_action": operation,
        "p_quote": str(quote_id) if quote_id else None,
        "p_data": data.model_dump(mode="json") if data else {},
    }).json()


def pdf(client, user, order_id, quote_id):
    from io import BytesIO
    from decimal import Decimal, ROUND_HALF_UP
    from xml.sax.saxutils import escape
    from reportlab.lib import colors
    from reportlab.lib.styles import getSampleStyleSheet
    from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
    order = authorized_order(client, user, order_id)
    quote = one(client, "quotes", quote_id)
    if quote["work_order_id"] != str(order_id) or (user.role == "CLIENT" and quote["status"] in ("DRAFT", "SUPERSEDED")):
        raise HTTPException(404, "Cotización no encontrada.")
    state = {"DRAFT": "Borrador", "SENT": "Pendiente de respuesta", "ACCEPTED": "Aceptada", "REJECTED": "Rechazada", "SUPERSEDED": "Sustituida"}[quote["status"]]
    owner = one(client, "profiles", order["vehicle"]["client_id"], "first_name,last_name,client_code")
    stream = BytesIO()
    styles = getSampleStyleSheet()
    def paragraph(value):
        return Paragraph(escape(str(value)), styles["BodyText"])
    body = [Paragraph("AutoTrack - Cotización", styles["Title"]),
            paragraph(f"Orden: {order_id}"), paragraph(f"Placa: {order['vehicle']['plate']}"),
            paragraph(f"Cliente: {owner.get('first_name','')} {owner.get('last_name','')} | Código: {owner.get('client_code','')}"),
            paragraph(f"Versión {quote['version']} | {state} | Vigencia: {quote['valid_until']}"), Spacer(1, 16)]
    rows = [["Concepto", "Cantidad", "Precio USD", "Importe USD"]]
    for item in quote["items"]:
        quantity, price = Decimal(str(item['quantity'])), Decimal(str(item['unit_price']))
        subtotal = (quantity * price).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
        rows.append([paragraph(item['description']), str(quantity), f"{price:.2f}", f"{subtotal:.2f}"])
    table = Table(rows, colWidths=[255, 65, 80, 80], repeatRows=1)
    table.setStyle(TableStyle([('BACKGROUND',(0,0),(-1,0),colors.HexColor('#e8edf2')),
        ('VALIGN',(0,0),(-1,-1),'TOP'),('BOTTOMPADDING',(0,0),(-1,-1),10),
        ('LINEBELOW',(0,0),(-1,0),1,colors.grey)]))
    body.extend([table, Spacer(1, 16), paragraph(f"Total USD: {Decimal(str(quote['total'])):.2f}"),
                 paragraph(quote.get('notes') or ''), paragraph('Cotización de servicio. No es una factura ni un comprobante de pago.')])
    if quote.get('decided_at'):
        body.append(paragraph(f"Respuesta registrada: {quote['decided_at']} | Usuario: {quote['decided_by']}"))
    SimpleDocTemplate(stream, rightMargin=48, leftMargin=48).build(body)
    return stream.getvalue()
