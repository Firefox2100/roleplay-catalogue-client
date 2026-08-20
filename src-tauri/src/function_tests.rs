use super::*;

#[test]
fn complete_local_coauthor_conversation_path() {
    let db = Connection::open_in_memory().unwrap();
    initialise_database(&db).unwrap();
    let conversation_id = "conversation-path";
    let resource_id = "preset-resource";

    let messages = persist_user_message(
        &db,
        conversation_id,
        Some(resource_id),
        "Tighten the selected system prompt.",
    )
    .unwrap();
    assert_eq!(messages.len(), 1);
    assert_eq!(messages[0].role, "user");

    let instructions = assistant_instructions(
        Some(&serde_json::json!({
            "prompts": [{"identifier": "main", "role": "system", "content": "Be helpful."}]
        })),
        None,
        "en-uk",
        "sillytavern/preset",
        Some(&EditorSelection {
            path: Some("preset.prompts.0.content".into()),
            selected_text: Some("Be helpful.".into()),
            cursor: Some(11),
        }),
    )
    .unwrap();
    assert!(instructions.contains("preset.prompts.0.content"));

    let envelope = parse_model_envelope(
        r#"{"reply":"This version is more specific.","proposals":[{"path":"preset.prompts.0.content","value":"Give concise, practical answers.","rationale":"Defines the desired response style."}]}"#,
    );
    assert!(model_envelope_errors(&envelope).is_empty());
    let proposals = envelope
        .proposals
        .into_iter()
        .map(|proposal| AiProposal {
            id: local_id("proposal"),
            path: proposal.path,
            value: proposal.value,
            rationale: proposal.rationale,
        })
        .collect::<Vec<_>>();
    let conversation =
        persist_assistant_response(&db, conversation_id, &envelope.reply, &proposals).unwrap();
    assert_eq!(conversation.resource_id.as_deref(), Some(resource_id));
    assert_eq!(conversation.messages.len(), 2);
    assert_eq!(
        conversation.messages[1].proposals[0].path,
        "preset.prompts.0.content"
    );

    let messages = persist_user_message(
        &db,
        conversation_id,
        Some(resource_id),
        "Keep the placeholder syntax unchanged.",
    )
    .unwrap();
    assert_eq!(messages.len(), 3);
    let title: String = db
        .query_row(
            "SELECT title FROM ai_conversations WHERE id = ?1",
            [conversation_id],
            |row| row.get(0),
        )
        .unwrap();
    assert_eq!(title, "Tighten the selected system prompt.");

    db.execute(
        "DELETE FROM ai_conversations WHERE id = ?1",
        [conversation_id],
    )
    .unwrap();
    let remaining: i64 = db
        .query_row(
            "SELECT COUNT(*) FROM ai_messages WHERE conversation_id = ?1",
            [conversation_id],
            |row| row.get(0),
        )
        .unwrap();
    assert_eq!(remaining, 0);
}

#[test]
fn database_initialisation_is_idempotent_and_preserves_data() {
    let db = Connection::open_in_memory().unwrap();
    initialise_database(&db).unwrap();
    persist_user_message(&db, "conversation", None, "Hello").unwrap();
    initialise_database(&db).unwrap();
    assert_eq!(
        load_ai_conversation(&db, "conversation")
            .unwrap()
            .messages
            .len(),
        1
    );
}
