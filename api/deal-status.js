const hubspot = require('@hubspot/api-client');

// Initialize the HubSpot Client
const hubspotClient = new hubspot.Client({ accessToken: process.env.HUBSPOT_ACCESS_TOKEN });

export default async function handler(req, res) {
    // 1. Get the Deal ID from the website's request
    const { dealId } = req.query;

    if (!dealId) {
        return res.status(400).json({ error: 'Deal ID is required' });
    }

    try {
        // 2. Define exactly which Deal Properties we need (From your CSV)
        const dealProperties = [
            "dealname", "amount", "dealstage", // Basics
            "sla_signature_timeframe_is_within_the_upcoming_5_months_",
            "budget_availability_options",
            "identified_deal_blockers_will_not_withhold_contract_signature_within_the_next_4_months",
            "estimated__go_live__date",
            "key_materials_sent_to_prospect",
            "commitment__document_type_",
            "recent_commitment_send_date",
            "site_it_partner",
            "signed_commitment_file",
            "recent_commitment_sig__date",
            "poc_associated",
            "asset_owner_approval___when_applicable___cloned_",
            "budget_approval",
            "contract_term__in_years_",
            "number_of_watches",
            "all_site_watches_have_been_activated_",
            "site_staff_had_a_training_session_",
            "it_approval_received",
            "security_gdpr_approval",
            "block_images_on_watch_",
            "data_lifetime_on_cvs",
            "data_lifetime_on_cloud",
            "handover_date__atp_fulfillment_",
            "contracted_billing_start_date"
        ];

        // 3. Fetch the Deal Data
        const dealResponse = await hubspotClient.crm.deals.basicApi.getById(dealId, dealProperties);

        // 4. Find the Associated Company
        let companyResponse = null;
        try {
            // Get association to company
            const associations = await hubspotClient.crm.deals.associationsApi.getAll(dealId, 'companies');
            
            if (associations.results && associations.results.length > 0) {
                const companyId = associations.results[0].id;
                
                // Define Company Properties needed (From your CSV)
                const companyProperties = [
                    "name", 
                    "hubspot_owner_id", 
                    "customer_potential_sites", 
                    "customer_potential_pools"
                ];

                // Fetch Company Data
                companyResponse = await hubspotClient.crm.companies.basicApi.getById(companyId, companyProperties);
            }
        } catch (err) {
            console.log("No company association found or error fetching company.");
        }

        // 5. Send the combined data back to the frontend
        res.status(200).json({
            deal: dealResponse.properties,
            company: companyResponse ? companyResponse.properties : null
        });

    } catch (e) {
        console.error(e);
        const message = e.message === 'HTTP request failed'
            ? JSON.stringify(e.response, null, 2)
            : e.message;
        res.status(500).json({ error: message });
    }
}
