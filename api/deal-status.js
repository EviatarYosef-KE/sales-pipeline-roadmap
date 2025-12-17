const hubspot = require('@hubspot/api-client');

// Initialize outside handler to reuse connection in warm lambdas for performance
const hubspotClient = new hubspot.Client({ accessToken: process.env.HUBSPOT_ACCESS_TOKEN });

export default async function handler(req, res) {
    // 1. Cache Control: Cache success responses for 60 seconds to save HubSpot API limits
    // 's-maxage' tells Vercel's CDN to cache it; 'stale-while-revalidate' keeps it snappy.
    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=30');

    const { dealId } = req.query;

    if (!dealId) {
        return res.status(400).json({ error: 'Deal ID is required' });
    }

    try {
        // 2. Define exactly which Deal Properties we need
        const dealProperties = [
            "dealname", "amount", "dealstage", 
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

        // 3. Optimization: Fetch Deal AND Associated Company IDs in a SINGLE call
        // The 4th argument ["companies"] specifically asks for association IDs
        const dealResponse = await hubspotClient.crm.deals.basicApi.getById(
            dealId, 
            dealProperties, 
            undefined, 
            ["companies"] 
        );

        const dealData = dealResponse.properties;
        let companyData = null;
        let ownerData = null;

        // 4. Handle Company Association safely
        // Structure is usually: { "companies": { "results": [ { "id": "123", ... } ] } }
        const associatedCompanies = dealResponse.associations?.companies?.results;

        if (associatedCompanies && associatedCompanies.length > 0) {
            const companyId = associatedCompanies[0].id;
            
            const companyProperties = [
                "name", 
                "hubspot_owner_id", 
                "customer_potential_sites", 
                "customer_potential_pools"
            ];

            try {
                // Fetch Company Data if an ID exists
                const companyResponse = await hubspotClient.crm.companies.basicApi.getById(companyId, companyProperties);
                companyData = companyResponse.properties;

                // 5. Fetch Owner Details if owner ID exists
                if (companyData.hubspot_owner_id) {
                    try {
                        const ownerResponse = await hubspotClient.crm.owners.basicApi.getById(companyData.hubspot_owner_id);
                        ownerData = {
                            firstName: ownerResponse.firstName,
                            lastName: ownerResponse.lastName,
                            email: ownerResponse.email
                        };
                    } catch (ownerErr) {
                        console.warn(`Warning: Found owner ID ${companyData.hubspot_owner_id} but failed to fetch details.`, ownerErr.message);
                        // Continue without owner data
                    }
                }
            } catch (err) {
                console.warn(`Warning: Found company ID ${companyId} but failed to fetch details.`, err.message);
                // We do NOT throw here, so the Deal data still loads even if Company fails
            }
        }

        // 6. Send combined data
        res.status(200).json({
            deal: dealData,
            company: companyData,
            owner: ownerData
        });

    } catch (e) {
        console.error("API Error:", e);
        
        // Intelligent Error Response
        const errorMessage = e.body && e.body.message 
            ? e.body.message 
            : (e.message || 'Internal Server Error');

        const status = e.code === 404 ? 404 : 500;
        
        res.status(status).json({ error: errorMessage });
    }
}
