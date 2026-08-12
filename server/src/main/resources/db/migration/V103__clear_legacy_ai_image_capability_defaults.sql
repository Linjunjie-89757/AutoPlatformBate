UPDATE tb_ai_case_config
SET capability_override_json = NULL
WHERE supports_image_input = 0
  AND REPLACE(capability_override_json, ' ', '') IN (
      '{"imageInput":false}',
      '{"textChat":null,"streamOutput":null,"structuredOutput":null,"imageInput":false,"longContext":null,"stableAvailable":null}'
  );
